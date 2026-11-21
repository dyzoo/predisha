import { matchClock, matchClockFromKickoff } from './match-clock'
import { combineOdds } from './odds'
import { applyVat } from './vat'
import type { TicketSelection, TicketSimulationMeta } from './types'

export const MIN_IN_PLAY_ODDS_FACTOR = 0.45

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
