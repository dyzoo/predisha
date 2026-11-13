import { getMatchAnalyses, type MatchAnalysis } from '@/lib/sports/service'
import type { FixtureStatus } from '@/lib/sports/provider'
import { buildMarkets } from './odds'
import { formatKickoffLabel } from './format'
import type { BetEvent } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const CATALOG_LOOKBACK_MS = 2 * DAY_MS
const CATALOG_LOOKAHEAD_MS = 30 * DAY_MS

export interface BetCatalog {
  events: BetEvent[]
  demo: boolean
  providerMessage: string
  providerOk: boolean
  generatedAt: string
}

function effectiveStatusFor(analysis: MatchAnalysis, now: Date): FixtureStatus {
  const status = analysis.fixture.status
  if (status === 'SCHEDULED' && analysis.fixture.kickoffUtc.getTime() < now.getTime() - 3 * 60 * 60 * 1000) {
    return 'FINISHED'
  }
  return status
}

export function buildBetEvent(analysis: MatchAnalysis, now: Date): BetEvent {
  const { fixture, prediction, competition, sport, home, away } = analysis
  const markets = buildMarkets(prediction)
  const effectiveStatus = effectiveStatusFor(analysis, now)
  const probability = prediction
    ? {
        home: prediction.outcomes.find(outcome => outcome.key === 'HOME')?.probability ?? 0,
        draw: prediction.outcomes.find(outcome => outcome.key === 'DRAW')?.probability ?? 0,
        away: prediction.outcomes.find(outcome => outcome.key === 'AWAY')?.probability ?? 0,
      }
    : null

  const hasScore =
    typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'

  return {
    id: fixture.id,
    competition: competition.name,
    competitionId: competition.id,
    sport: sport.name,
    sportId: sport.id,
    status: fixture.status,
    effectiveStatus,
    live: effectiveStatus === 'LIVE',
    home: {
      id: home.id,
      name: home.name,
      short: home.shortName || home.name.slice(0, 3).toUpperCase(),
      color: home.color,
      logoUrl: home.logoUrl ?? null,
    },
    away: {
      id: away.id,
      name: away.name,
      short: away.shortName || away.name.slice(0, 3).toUpperCase(),
      color: away.color,
      logoUrl: away.logoUrl ?? null,
    },
    kickoffIso: fixture.kickoffUtc.toISOString(),
    kickoffLabel: formatKickoffLabel(fixture.kickoffUtc.toISOString()),
    score: hasScore ? { home: fixture.homeScore as number, away: fixture.awayScore as number } : null,
    markets,
    probability,
    expectedGoals: prediction
      ? { home: prediction.homeExpectedGoals, away: prediction.awayExpectedGoals }
      : null,
    modelVersion: prediction?.modelVersion ?? null,
    simulated: true,
    oddsAsOf: now.toISOString(),
    sourceLabel: analysis.isDemo
      ? 'Fictional demo fixtures · model-implied simulated odds'
      : 'Live fixture feed · model-implied simulated odds',
  }
}

function sortEvents(events: BetEvent[]): BetEvent[] {
  const rank = (event: BetEvent) => {
    if (event.effectiveStatus === 'LIVE') return 0
    if (event.effectiveStatus === 'SCHEDULED') return 1
    return 2
  }
  return [...events].sort((left, right) => {
    const rankDiff = rank(left) - rank(right)
    if (rankDiff !== 0) return rankDiff
    return new Date(left.kickoffIso).getTime() - new Date(right.kickoffIso).getTime()
  })
}

export async function getBetCatalog(now: Date = new Date()): Promise<BetCatalog> {
  const { analyses, dataset } = await getMatchAnalyses(now)
  const events = analyses
    .filter(analysis => {
      const kickoff = analysis.fixture.kickoffUtc.getTime()
      return (
        kickoff >= now.getTime() - CATALOG_LOOKBACK_MS &&
        kickoff <= now.getTime() + CATALOG_LOOKAHEAD_MS
      )
    })
    .map(analysis => buildBetEvent(analysis, now))
    .filter(event => event.markets.length > 0)

  return {
    events: sortEvents(events),
    demo: dataset.isDemo,
    providerMessage: dataset.health.message,
    providerOk: dataset.health.ok,
    generatedAt: now.toISOString(),
  }
}

export async function getBetEvent(
  fixtureId: string,
  now: Date = new Date(),
): Promise<{ event: BetEvent | null; catalog: BetCatalog }> {
  const catalog = await getBetCatalog(now)
  return {
    event: catalog.events.find(event => event.id === fixtureId) ?? null,
    catalog,
  }
}

export interface FixtureResult {
  status: FixtureStatus
  homeScore: number | null
  awayScore: number | null
}

export async function getFixtureResults(
  now: Date = new Date(),
): Promise<Map<string, FixtureResult>> {
  const { analyses } = await getMatchAnalyses(now)
  return new Map(
    analyses.map(analysis => [
      analysis.fixture.id,
      {
        status: analysis.fixture.status,
        homeScore: analysis.fixture.homeScore ?? null,
        awayScore: analysis.fixture.awayScore ?? null,
      },
    ]),
  )
}
