import { Prisma, type AdminBetSlip } from '@prisma/client'
import { computeTicketTotals } from './bets'
import { formatKickoffLabel } from './format'
import { propagateAdminSlipChange } from './slip-propagation'
import { isProviderFixtureId, type TicketSelection } from './types'
import { FootballDataProvider } from '@/lib/sports/football-data'
import type { Fixture, FixtureStatus } from '@/lib/sports/provider'
import { prisma } from '@/lib/prisma'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const LOOKBACK_DAYS = 2
const LOOKAHEAD_DAYS = 8
const SNAPSHOT_TTL_MS = 5 * 60 * 1000
const SEARCH_TIMEOUT_MS = 1800
const MATCH_THRESHOLD = 0.6
const CLUB_WORDS = new Set(['fc', 'afc', 'club'])

export interface FixtureSuggestion {
  fixtureId: string
  fixtureLabel: string
  home: string
  away: string
  competition: string
  kickoffIso: string
  kickoffLabel: string
  status: FixtureStatus
  live: boolean
  score: { home: number; away: number } | null
  minute: number | null
}

interface ProviderFixtureSnapshot {
  fixtures: Fixture[]
  competitionNames: Map<string, string>
}

interface SnapshotWindow {
  from: Date
  to: Date
  key: string
}

interface SnapshotCacheEntry {
  at: number
  promise: Promise<ProviderFixtureSnapshot>
  value: ProviderFixtureSnapshot | null
}

const EMPTY_SNAPSHOT: ProviderFixtureSnapshot = { fixtures: [], competitionNames: new Map() }
const snapshotCache = new Map<string, SnapshotCacheEntry>()

function tokensFor(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !CLUB_WORDS.has(token))
}

function teamScore(left: string | undefined, right: string | undefined): number {
  const a = tokensFor(left ?? '')
  const b = tokensFor(right ?? '')
  if (a.length === 0 || b.length === 0) return 0
  const joinedA = a.join(' ')
  const joinedB = b.join(' ')
  if (joinedA === joinedB || joinedA.includes(joinedB) || joinedB.includes(joinedA)) return 1
  const aSet = new Set(a)
  const bSet = new Set(b)
  const overlap = [...aSet].filter(token => bSet.has(token)).length
  return overlap / new Set([...aSet, ...bSet]).size
}

function scorePair(fixture: Fixture): { home: number; away: number } | null {
  if (typeof fixture.homeScore !== 'number' || typeof fixture.awayScore !== 'number') return null
  return { home: fixture.homeScore, away: fixture.awayScore }
}

function windowFor(anchorMs: number): SnapshotWindow {
  const from = new Date(anchorMs - LOOKBACK_DAYS * DAY_MS)
  const to = new Date(from.getTime() + (LOOKBACK_DAYS + LOOKAHEAD_DAYS) * DAY_MS)
  return { from, to, key: `${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}` }
}

function selectionWindow(selections: TicketSelection[], now: Date): SnapshotWindow {
  const kickoffs = selections
    .map(selection => new Date(selection.kickoffIso).getTime())
    .filter(value => Number.isFinite(value))
  return windowFor(kickoffs.length > 0 ? Math.min(...kickoffs) : now.getTime())
}

function loadProviderSnapshot(window: SnapshotWindow): Promise<ProviderFixtureSnapshot> {
  const cached = snapshotCache.get(window.key)
  if (cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached.promise

  const promise = (async () => {
    const provider = new FootballDataProvider()
    const [fixtures, competitions] = await Promise.all([
      provider.getFixtures(window.from, window.to),
      provider.getCompetitions(),
    ])
    return {
      fixtures,
      competitionNames: new Map(competitions.map(item => [item.id, item.name])),
    }
  })().catch(() => EMPTY_SNAPSHOT)

  if (snapshotCache.size > 12) snapshotCache.clear()
  const entry: SnapshotCacheEntry = { at: Date.now(), promise, value: null }
  snapshotCache.set(window.key, entry)
  void promise.then(value => {
    entry.value = value
    entry.at = Date.now()
  })
  return promise
}

function cachedProviderSnapshot(window: SnapshotWindow): ProviderFixtureSnapshot | null {
  const entry = snapshotCache.get(window.key)
  if (!entry || Date.now() - entry.at > SNAPSHOT_TTL_MS) return null
  return entry.value && entry.value.fixtures.length > 0 ? entry.value : null
}

async function withTimeout(
  promise: Promise<ProviderFixtureSnapshot>,
  ms: number,
): Promise<ProviderFixtureSnapshot> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ProviderFixtureSnapshot>(resolve => {
    timer = setTimeout(() => resolve(EMPTY_SNAPSHOT), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export function toFixtureSuggestion(
  fixture: Fixture,
  competitionNames: Map<string, string>,
): FixtureSuggestion {
  const home = fixture.homeTeam?.name ?? `Team ${fixture.homeTeamId}`
  const away = fixture.awayTeam?.name ?? `Team ${fixture.awayTeamId}`
  const kickoffIso = fixture.kickoffUtc.toISOString()
  const liveScore =
    fixture.status === 'LIVE' &&
    typeof fixture.liveHomeScore === 'number' &&
    typeof fixture.liveAwayScore === 'number'
      ? { home: fixture.liveHomeScore, away: fixture.liveAwayScore }
      : scorePair(fixture)
  return {
    fixtureId: fixture.id,
    fixtureLabel: `${home} vs ${away}`,
    home,
    away,
    competition: competitionNames.get(fixture.competitionId) ?? fixture.competitionId,
    kickoffIso,
    kickoffLabel: formatKickoffLabel(kickoffIso),
    status: fixture.status,
    live: fixture.status === 'LIVE',
    score: liveScore,
    minute: fixture.status === 'LIVE' ? fixture.liveMinute ?? null : null,
  }
}

export async function searchAdminFixtureSuggestions(
  query: string,
  now: Date = new Date(),
  limit = 12,
): Promise<FixtureSuggestion[]> {
  const tokens = tokensFor(query)
  if (tokens.length === 0) return []
  const { fixtures, competitionNames } = await withTimeout(
    loadProviderSnapshot(windowFor(now.getTime())),
    SEARCH_TIMEOUT_MS,
  )
  const matches = fixtures.filter(fixture => {
    const haystack = tokensFor(
      [
        fixture.homeTeam?.name ?? '',
        fixture.awayTeam?.name ?? '',
        competitionNames.get(fixture.competitionId) ?? fixture.competitionId,
      ].join(' '),
    )
    return tokens.every(token => haystack.includes(token))
  })
  matches.sort((left, right) => {
    const leftRank = left.status === 'LIVE' ? 0 : 1
    const rightRank = right.status === 'LIVE' ? 0 : 1
    if (leftRank !== rightRank) return leftRank - rightRank
    const leftDelta = Math.abs(left.kickoffUtc.getTime() - now.getTime())
    const rightDelta = Math.abs(right.kickoffUtc.getTime() - now.getTime())
    return leftDelta - rightDelta
  })
  return matches.slice(0, limit).map(fixture => toFixtureSuggestion(fixture, competitionNames))
}

function fixtureMatchScore(
  selection: TicketSelection,
  fixture: Fixture,
  competitionNames: Map<string, string>,
): number {
  const parts = (selection.fixtureLabel ?? '').split(/\s+vs\.?\s+/i)
  const home = parts[0] ?? ''
  const away = parts.slice(1).join(' vs ')
  const homeName = fixture.homeTeam?.name ?? ''
  const awayName = fixture.awayTeam?.name ?? ''
  const direct = (teamScore(home, homeName) + teamScore(away, awayName)) / 2
  const swapped = (teamScore(home, awayName) + teamScore(away, homeName)) / 2
  const nameScore = Math.max(direct, swapped)
  if (nameScore <= 0) return 0
  const competitionName = competitionNames.get(fixture.competitionId) ?? ''
  const competitionScore = teamScore(selection.competition ?? '', competitionName)
  const kickoffMs = new Date(selection.kickoffIso).getTime()
  if (!Number.isFinite(kickoffMs)) return 0
  const deltaHours = Math.abs(fixture.kickoffUtc.getTime() - kickoffMs) / HOUR_MS
  const timeScore =
    deltaHours <= 2
      ? 1
      : deltaHours <= 24
        ? 1 - (deltaHours - 2) / 44
        : deltaHours <= 72
          ? 0.5 - (deltaHours - 24) / 96
          : 0
  if (timeScore <= 0) return 0
  return nameScore * 0.7 + timeScore * 0.25 + competitionScore * 0.05
}

function applyFixture(selection: TicketSelection, fixture: Fixture, competitionName: string): TicketSelection {
  const kickoffIso = fixture.kickoffUtc.toISOString()
  return {
    ...selection,
    fixtureId: fixture.id,
    fixtureLabel: `${fixture.homeTeam?.name ?? `Team ${fixture.homeTeamId}`} vs ${fixture.awayTeam?.name ?? `Team ${fixture.awayTeamId}`}`,
    competition: competitionName || fixture.competitionId,
    kickoffIso,
    kickoffLabel: formatKickoffLabel(kickoffIso),
    ...(selection.simulation
      ? { simulation: { ...selection.simulation, kickoffIso } }
      : {}),
  }
}

function reconcileWithSnapshot(
  selections: TicketSelection[],
  snapshot: ProviderFixtureSnapshot,
): TicketSelection[] {
  const { fixtures, competitionNames } = snapshot
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  const used = new Set<string>()

  return selections.map(selection => {
    if (selection.result !== 'PENDING' || selection.finalScore) return selection
    const exact = isProviderFixtureId(selection.fixtureId)
      ? byId.get(selection.fixtureId)
      : undefined
    if (exact) {
      used.add(exact.id)
      return applyFixture(selection, exact, competitionNames.get(exact.competitionId) ?? selection.competition ?? '')
    }

    let best: { fixture: Fixture; score: number } | null = null
    for (const fixture of fixtures) {
      if (used.has(fixture.id)) continue
      const score = fixtureMatchScore(selection, fixture, competitionNames)
      if (score > (best?.score ?? 0)) best = { fixture, score }
    }
    if (!best || best.score < MATCH_THRESHOLD) return selection
    used.add(best.fixture.id)
    return applyFixture(selection, best.fixture, competitionNames.get(best.fixture.competitionId) ?? selection.competition ?? '')
  })
}

export function reconcileTicketSelections(
  selections: TicketSelection[],
  now: Date = new Date(),
): TicketSelection[] {
  const window = selectionWindow(selections, now)
  const snapshot = cachedProviderSnapshot(window)
  if (!snapshot) return selections
  return reconcileWithSnapshot(selections, snapshot)
}

function parseSelections(value: Prisma.JsonValue): TicketSelection[] {
  if (!Array.isArray(value)) return []
  return value as unknown as TicketSelection[]
}

export async function reconcileAdminSlipSelections(
  slip: AdminBetSlip,
  now: Date = new Date(),
): Promise<AdminBetSlip> {
  const selections = parseSelections(slip.selections)
  const reconciled = reconcileTicketSelections(selections, now)
  if (JSON.stringify(reconciled) === JSON.stringify(selections)) return slip

  const totals = computeTicketTotals(slip.stakeMinor, reconciled)
  const data: Prisma.AdminBetSlipUpdateInput = {
    selections: reconciled as unknown as Prisma.InputJsonValue,
    totalOdds: totals.totalOdds,
    potentialReturnMinor: totals.potentialReturnMinor,
  }
  if (slip.timeMode === 'ORIGINAL') {
    const kickoffs = reconciled
      .map(selection => new Date(selection.kickoffIso).getTime())
      .filter(value => Number.isFinite(value))
    const lastKickoff = kickoffs.length > 0 ? new Date(Math.max(...kickoffs)) : null
    if (lastKickoff && lastKickoff.getTime() > now.getTime()) data.autoFreezeAt = lastKickoff
  }

  return prisma.$transaction(async tx => {
    const next = await tx.adminBetSlip.update({ where: { id: slip.id }, data })
    await propagateAdminSlipChange(tx, { slipId: slip.id, selections: reconciled })
    return next
  })
}
