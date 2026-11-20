import type { FixtureResult } from './catalog'
import { buildCashoutQuote, type CashoutOutcome } from './cashout'
import { matchClock } from './match-clock'
import { settleMarket } from './odds'
import { hashString, mulberry32 } from './random-pure'
import type { TicketSelection, TicketSimulationMeta } from './types'

export const DEFAULT_SIMULATED_DURATION_MINUTES = 90

export type SimulationClock = TicketSimulationMeta

function toClockIso(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function simulationClockForSelection(
  selection: TicketSelection,
  clock: SimulationClock,
): SimulationClock {
  const kickoffIso =
    toClockIso(selection.kickoffIso) ?? toClockIso(clock.kickoffIso) ?? clock.liveStartedAt
  return {
    ...clock,
    liveStartedAt: kickoffIso,
    kickoffIso,
  }
}

export function attachSimulationClock(
  selections: TicketSelection[],
  clock: SimulationClock,
): TicketSelection[] {
  return selections.map(selection => ({
    ...selection,
    simulation: simulationClockForSelection(selection, clock),
  }))
}

export function simulationClockFromSelection(
  selection: TicketSelection,
): SimulationClock | null {
  return selection.simulation ?? null
}

export function selectionHasStarted(selection: TicketSelection, now: number = Date.now()): boolean {
  const clock = simulationClockFromSelection(selection)
  if (clock) return matchClock(clock, now).started
  const kickoffIso = toClockIso(selection.kickoffIso)
  return kickoffIso ? new Date(kickoffIso).getTime() <= now : false
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

interface SimulatedScore {
  home: number
  away: number
}

const FINAL_SCORE_CANDIDATES: SimulatedScore[] = (() => {
  const scores: SimulatedScore[] = []
  for (let home = 0; home <= 9; home += 1) {
    for (let away = 0; away <= 9; away += 1) scores.push({ home, away })
  }
  return scores
})()

function scoreDistance(left: SimulatedScore, right: SimulatedScore): number {
  return Math.abs(left.home - right.home) + Math.abs(left.away - right.away)
}

export function simulatedFinalScore(
  selection: TicketSelection,
  clock: SimulationClock,
): SimulatedScore {
  const random = mulberry32(
    hashString(`${clock.seed}:${selection.fixtureId}:${selection.selectionId}:final`),
  )
  const preferred = { home: Math.floor(random() * 4), away: Math.floor(random() * 4) }
  const candidates = [...FINAL_SCORE_CANDIDATES].sort((left, right) => {
    const distance = scoreDistance(left, preferred) - scoreDistance(right, preferred)
    if (distance !== 0) return distance
    const goals = left.home + left.away - (right.home + right.away)
    if (goals !== 0) return goals
    return left.home - right.home || left.away - right.away
  })

  for (const candidate of candidates) {
    if (settleMarket(selection.selectionId, candidate.home, candidate.away) === true) {
      return candidate
    }
  }
  return preferred
}

function goalMinute(
  clock: SimulationClock,
  selection: TicketSelection,
  index: number,
): number {
  const random = mulberry32(
    hashString(`${clock.seed}:${selection.fixtureId}:goal:${index}`),
  )
  const rawMinute = 1 + Math.floor(random() * 89)
  const duration = Math.max(1, clock.durationMinutes)
  return Math.max(1, Math.min(duration, Math.ceil((rawMinute / 90) * duration)))
}

export function simulatedScore(
  selection: TicketSelection,
  clock: SimulationClock,
  minute: number,
): SimulatedScore {
  const final = simulatedFinalScore(selection, clock)
  if (minute >= clock.durationMinutes) return final

  const homeGoals = Array.from({ length: final.home }, (_, index) => goalMinute(clock, selection, index))
  const awayGoals = Array.from(
    { length: final.away },
    (_, index) => goalMinute(clock, selection, final.home + index),
  )
  return {
    home: homeGoals.filter(value => value <= minute).length,
    away: awayGoals.filter(value => value <= minute).length,
  }
}

export function simulatedResultsForTicket(
  selections: TicketSelection[],
  results: Map<string, FixtureResult>,
  now: number = Date.now(),
): Map<string, FixtureResult> {
  const merged = new Map(results)
  for (const selection of selections) {
    const clock = selection.simulation
    if (!clock || !matchClock(clock, now).finished) continue
    const final = simulatedFinalScore(selection, clock)
    merged.set(selection.fixtureId, {
      status: 'FINISHED',
      homeScore: final.home,
      awayScore: final.away,
    })
  }
  return merged
}

function projectedOutcome(
  selection: TicketSelection,
  clock: SimulationClock,
): boolean | null {
  const final = simulatedFinalScore(selection, clock)
  return settleMarket(selection.selectionId, final.home, final.away)
}

export function simulatedCashoutOffer(input: {
  stakeMinor: number
  potentialReturnMinor: number
  selections: TicketSelection[]
  clock?: SimulationClock | null
  now?: number
}): { offer: number; blocked: boolean } {
  const now = input.now ?? Date.now()
  let progress = 0
  let wins = 0
  let losses = 0
  let started = 0

  for (const selection of input.selections) {
    const clock =
      selection.simulation ??
      (input.clock ? simulationClockForSelection(selection, input.clock) : null)
    if (!clock) continue
    const state = matchClock(clock, now)
    if (!state.started) continue

    started += 1
    progress = Math.max(progress, state.progress)
    const outcome = projectedOutcome(selection, clock)
    if (outcome === true) wins += 1
    if (outcome === false) losses += 1
  }

  if (started === 0) return { offer: 0, blocked: true }

  let outcome: CashoutOutcome = 'UNKNOWN'
  if (losses > 0 && wins > 0) outcome = 'MIXED'
  else if (losses > 0) outcome = 'LOSE'
  else if (wins === started) outcome = 'WIN'

  const seed =
    input.clock?.seed ??
    input.selections.find(selection => selection.simulation)?.simulation?.seed ??
    ''

  if (outcome === 'WIN') {
    const stake = Math.max(0, Math.floor(input.stakeMinor))
    const potential = Math.max(stake, Math.floor(input.potentialReturnMinor))
    const profit = Math.max(0, potential - stake)
    const bucket = Math.floor(now / 30_000)
    const bonus = (hashString(`${seed}:cashout:${bucket}`) % 12) / 1000
    const raw = stake + profit * (0.35 + 0.45 * progress)
    const offer = Math.floor(Math.min(potential, Math.max(stake, raw * (1 + bonus))))
    return { offer, blocked: false }
  }

  return buildCashoutQuote({
    stakeMinor: input.stakeMinor,
    potentialReturnMinor: input.potentialReturnMinor,
    outcome,
    progress,
    seed,
    now,
  })
}

export function formatSimulationClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
