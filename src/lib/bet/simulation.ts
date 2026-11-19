import { buildCashoutQuote, type CashoutOutcome } from './cashout'
import { matchClock } from './match-clock'
import { settleMarket } from './odds'
import { hashString, mulberry32 } from './random-pure'
import type { TicketSelection, TicketSimulationMeta } from './types'

export const DEFAULT_SIMULATED_DURATION_MINUTES = 90

export type SimulationClock = TicketSimulationMeta

export function attachSimulationClock(
  selections: TicketSelection[],
  clock: SimulationClock,
): TicketSelection[] {
  return selections.map(selection => ({ ...selection, simulation: { ...clock } }))
}

export function simulationClockFromSelection(
  selection: TicketSelection,
): SimulationClock | null {
  return selection.simulation ?? null
}

export function simulationElapsedMs(clock: SimulationClock, now: number = Date.now()): number {
  const started = new Date(clock.liveStartedAt).getTime()
  if (Number.isNaN(started)) return 0
  return Math.max(0, now - started)
}

export function simulationMinute(clock: SimulationClock, now: number = Date.now()): number {
  return matchClock(clock, now).minute
}

export function simulationRemainingSeconds(clock: SimulationClock, now: number = Date.now()): number {
  const durationMs = Math.max(1, clock.durationMinutes) * 60_000
  return Math.max(0, Math.ceil((durationMs - simulationElapsedMs(clock, now)) / 1000))
}

export function simulationIsLive(clock: SimulationClock, now: number = Date.now()): boolean {
  const started = new Date(clock.liveStartedAt).getTime()
  if (Number.isNaN(started)) return false
  return matchClock(clock, now).live
}

export function simulatedScore(
  selection: TicketSelection,
  clock: SimulationClock,
  minute: number,
): { home: number; away: number } {
  const random = mulberry32(
    hashString(`${clock.seed}:${selection.fixtureId}:${selection.selectionId}`),
  )
  const finalHome = Math.floor(random() * 4)
  const finalAway = Math.floor(random() * 4)
  const homeGoals = Array.from({ length: finalHome }, () => 1 + Math.floor(random() * 89))
  const awayGoals = Array.from({ length: finalAway }, () => 1 + Math.floor(random() * 89))
  return {
    home: homeGoals.filter(value => value <= minute).length,
    away: awayGoals.filter(value => value <= minute).length,
  }
}

export function simulatedCashoutOffer(input: {
  stakeMinor: number
  potentialReturnMinor: number
  selections: TicketSelection[]
  clock: SimulationClock
  now?: number
}): { offer: number; blocked: boolean } {
  const now = input.now ?? Date.now()
  const minute = simulationMinute(input.clock, now)
  let wins = 0
  let losses = 0

  for (const selection of input.selections) {
    const score = simulatedScore(selection, input.clock, minute)
    const outcome = settleMarket(selection.selectionId, score.home, score.away)
    if (outcome === true) wins += 1
    if (outcome === false) losses += 1
  }

  let outcome: CashoutOutcome = 'UNKNOWN'
  if (losses > 0 && wins > 0) outcome = 'MIXED'
  else if (losses > 0) outcome = 'LOSE'
  else if (wins === input.selections.length) outcome = 'WIN'

  return buildCashoutQuote({
    stakeMinor: input.stakeMinor,
    potentialReturnMinor: input.potentialReturnMinor,
    outcome,
    progress: matchClock(input.clock, now).progress,
    seed: input.clock.seed,
    now,
  })
}

export function formatSimulationClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
