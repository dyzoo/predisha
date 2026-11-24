import { matchClock, matchClockFromKickoff } from './match-clock'
import { combineOdds } from './odds'
import { DEFAULT_SIMULATED_DURATION_MINUTES, simulatedScore, simulationClockForSelection } from './simulation'
import {
  formatLiveMinute,
  isProviderFixtureId,
  type BetEvent,
  type TicketSelection,
  type TicketSimulationMeta,
} from './types'
import { applyVat } from './vat'

export const MIN_IN_PLAY_ODDS_FACTOR = 0.45

export interface LiveMatchRow {
  fixtureId: string
  competition: string
  kickoffIso: string
  minute: number | null
  label?: string
  score: { home: number; away: number } | null
  home: { name: string; short: string; color: string; logoUrl?: string | null }
  away: { name: string; short: string; color: string; logoUrl?: string | null }
}

function roundOdds(value: number): number {
  return Math.round(value * 100) / 100
}

export function inPlayOddsFactor(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round((1 - (1 - MIN_IN_PLAY_ODDS_FACTOR) * clamped) * 1000) / 1000
}

export function inPlayProgress(clock: TicketSimulationMeta, now: number = Date.now()): number {
  const state = matchClock(clock, now)
  return state.started ? state.progress : 0
}

export function clockFromKickoff(
  kickoffIso: string,
  durationMinutes: number,
  seed: string,
  now: number = Date.now(),
): TicketSimulationMeta | null {
  const kickoff = new Date(kickoffIso).getTime()
  if (Number.isNaN(kickoff) || kickoff > now) return null
  return {
    liveStartedAt: new Date(kickoff).toISOString(),
    durationMinutes,
    seed,
    kickoffIso,
  }
}

export function selectionHasLiveOverride(selection: TicketSelection): boolean {
  return (
    selection.result === 'PENDING' &&
    !selection.finalScore &&
    (selection.liveScore != null || selection.liveMinute != null)
  )
}

function liveMatchTeams(selection: TicketSelection): Pick<LiveMatchRow, 'home' | 'away'> {
  const [homeName = 'Home', awayName = 'Away'] = selection.fixtureLabel.split(/\s+vs\.?\s+/i)
  return {
    home: { name: homeName, short: homeName.slice(0, 3).toUpperCase(), color: '#10b981' },
    away: { name: awayName, short: awayName.slice(0, 3).toUpperCase(), color: '#ef4444' },
  }
}

export function liveMatchesForSelections(
  selections: TicketSelection[],
  fallbackClock: TicketSimulationMeta | null,
  events: BetEvent[],
  now: Date = new Date(),
): LiveMatchRow[] {
  const eventById = new Map(events.map(event => [event.id, event]))
  const rows: LiveMatchRow[] = []
  const seen = new Set<string>()

  for (const selection of selections) {
    if (seen.has(selection.fixtureId)) continue
    seen.add(selection.fixtureId)

    const event = eventById.get(selection.fixtureId)
    const override = selectionHasLiveOverride(selection)
    const baseClock: TicketSimulationMeta = fallbackClock ?? {
      liveStartedAt: selection.kickoffIso,
      durationMinutes: DEFAULT_SIMULATED_DURATION_MINUTES,
      seed: selection.fixtureId,
      kickoffIso: selection.kickoffIso,
    }
    const clock = selection.simulation ?? simulationClockForSelection(selection, baseClock)
    const clockState = matchClock(clock, now.getTime())
    if (!event?.live && !override && !clockState.live) continue

    const teams = liveMatchTeams(selection)
    const simulated = isProviderFixtureId(selection.fixtureId)
      ? null
      : simulatedScore(selection, clock, clockState.minute)
    const score =
      override && selection.liveScore
        ? selection.liveScore
        : (event?.score ?? simulated)
    const minute =
      override && selection.liveMinute != null
        ? selection.liveMinute
        : (event?.minute ?? clockState.minute)
    const label =
      override && selection.liveMinute != null
        ? formatLiveMinute(selection.liveMinute)
        : event?.minute != null
          ? formatLiveMinute(event.minute)
          : clockState.live
            ? clockState.label
            : null

    rows.push({
      fixtureId: selection.fixtureId,
      competition: selection.competition || event?.competition || '',
      kickoffIso: event?.kickoffIso ?? selection.kickoffIso,
      minute,
      label: label ?? undefined,
      score,
      home: event?.home ?? teams.home,
      away: event?.away ?? teams.away,
    })
  }

  return rows
}

export function applyInPlayOdds(
  selections: TicketSelection[],
  clock: TicketSimulationMeta,
  now: number = Date.now(),
): { selections: TicketSelection[]; factor: number; progress: number } {
  let factor = 1
  let progress = 0
  const adjusted = selections.map(selection => {
    const selectionClock = selection.simulation ?? clock
    const selectionProgress = inPlayProgress(selectionClock, now)
    const selectionFactor = inPlayOddsFactor(selectionProgress)
    factor = Math.min(factor, selectionFactor)
    progress = Math.max(progress, selectionProgress)
    const baseOdds = selection.baseOdds ?? selection.odds
    return {
      ...selection,
      baseOdds,
      inPlayFactor: selectionFactor,
      odds: Math.max(1.01, roundOdds(baseOdds * selectionFactor)),
    }
  })
  return { selections: adjusted, factor, progress }
}

export function inPlayQuote(
  stakeMinor: number,
  selections: TicketSelection[],
  clock: TicketSimulationMeta | null,
  now: number = Date.now(),
): {
  selections: TicketSelection[]
  factor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
} {
  if (!clock) {
    const totalOdds = combineOdds(selections.map(selection => selection.odds))
    const potentialReturnMinor = Math.floor(stakeMinor * totalOdds)
    const vat = applyVat(potentialReturnMinor)
    return {
      selections,
      factor: 1,
      totalOdds,
      potentialReturnMinor,
      vatMinor: vat.vatMinor,
      netPayoutMinor: vat.netPayoutMinor,
    }
  }

  const adjusted = applyInPlayOdds(selections, clock, now)
  const preDiscountTotalOdds = combineOdds(
    adjusted.selections.map(selection => selection.baseOdds ?? selection.odds),
  )
  const totalOdds = combineOdds(adjusted.selections.map(selection => selection.odds))
  const factor =
    preDiscountTotalOdds > 0 ? Math.round((totalOdds / preDiscountTotalOdds) * 1000) / 1000 : 1
  const potentialReturnMinor = Math.floor(stakeMinor * totalOdds)
  const vat = applyVat(potentialReturnMinor)
  return {
    selections: adjusted.selections,
    factor,
    totalOdds,
    potentialReturnMinor,
    vatMinor: vat.vatMinor,
    netPayoutMinor: vat.netPayoutMinor,
  }
}

export function liveClockLabel(clock: TicketSimulationMeta, now: number = Date.now()): string {
  return matchClock(clock, now).label
}

export function startedClockLabel(
  kickoffIso: string,
  durationMinutes: number,
  now: number = Date.now(),
): string {
  return matchClockFromKickoff(kickoffIso, durationMinutes, now).label
}
