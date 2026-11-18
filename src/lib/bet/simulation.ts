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
  const duration = Math.max(1, clock.durationMinutes)
  return Math.min(duration, Math.max(1, Math.floor(simulationElapsedMs(clock, now) / 60_000) + 1))
}

export function simulationRemainingSeconds(clock: SimulationClock, now: number = Date.now()): number {
  const durationMs = Math.max(1, clock.durationMinutes) * 60_000
  return Math.max(0, Math.ceil((durationMs - simulationElapsedMs(clock, now)) / 1000))
}

export function simulationIsLive(clock: SimulationClock, now: number = Date.now()): boolean {
  const started = new Date(clock.liveStartedAt).getTime()
  if (Number.isNaN(started)) return false
  return now >= started && simulationRemainingSeconds(clock, now) > 0
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
  let allWinning = true

  for (const selection of input.selections) {
    const score = simulatedScore(selection, input.clock, minute)
    const outcome = settleMarket(selection.selectionId, score.home, score.away)
    if (outcome === false) return { offer: 0, blocked: true }
    if (outcome !== true) allWinning = false
  }

  const base = allWinning
    ? Math.floor(input.potentialReturnMinor * 0.65)
    : Math.floor(input.stakeMinor * 0.5)
  const progress = minute / Math.max(1, input.clock.durationMinutes)
  const bucket = Math.floor(now / 30_000)
  const jitter = ((hashString(`${input.clock.seed}:cashout:${bucket}`) % 17) - 8) / 100
  const multiplier = Math.min(1.08, Math.max(0.55, 0.72 + progress * 0.28 + jitter))
  const offer = Math.max(1, Math.min(input.potentialReturnMinor, Math.floor(base * multiplier)))

  return { offer, blocked: false }
}

export function formatSimulationClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
