import { describe, expect, it } from 'vitest'
import { settleMarket } from './odds'
import {
  attachSimulationClock,
  simulatedCashoutOffer,
  simulatedScore,
  simulationIsLive,
  simulationMinute,
  simulationRemainingSeconds,
} from './simulation'
import type { TicketSelection, TicketSimulationMeta } from './types'

const clock: TicketSimulationMeta = {
  liveStartedAt: '2026-01-01T12:00:00.000Z',
  durationMinutes: 90,
  seed: 'ABC123',
  kickoffIso: '2026-01-01T12:00:00.000Z',
}

function selection(): TicketSelection {
  return {
    fixtureId: 'random-1',
    fixtureLabel: 'Team A vs Team B',
    competition: 'Test League',
    kickoffIso: clock.kickoffIso,
    marketId: '1x2',
    marketName: 'Match result',
    selectionId: 'HOME',
    selectionLabel: 'Home win',
    odds: 2.2,
    probability: 0.45,
    result: 'PENDING',
    finalScore: null,
    demoResult: false,
  }
}

describe('simulation clock', () => {
  it('advances minutes from the manual start and clamps at full time', () => {
    expect(simulationMinute(clock, Date.parse('2026-01-01T12:00:30.000Z'))).toBe(1)
    expect(simulationMinute(clock, Date.parse('2026-01-01T12:10:00.000Z'))).toBe(11)
    expect(simulationMinute(clock, Date.parse('2026-01-01T14:00:00.000Z'))).toBe(90)
  })

  it('reports live state and remaining time', () => {
    expect(simulationIsLive(clock, Date.parse('2026-01-01T12:00:00.000Z'))).toBe(true)
    expect(simulationIsLive(clock, Date.parse('2026-01-01T11:59:59.000Z'))).toBe(false)
    expect(simulationRemainingSeconds(clock, Date.parse('2026-01-01T12:00:00.000Z'))).toBe(5400)
  })

  it('attaches the same clock to every selection', () => {
    const attached = attachSimulationClock([selection(), selection()], clock)
    expect(attached).toHaveLength(2)
    expect(attached[0]?.simulation).toEqual(clock)
    expect(attached[1]?.simulation).toEqual(clock)
  })
})

describe('simulated cashout', () => {
  it('prices a simulated live ticket from its stake, odds and clock', () => {
    const item = selection()
    const now = Date.parse('2026-01-01T12:30:00.000Z')
    const minute = simulationMinute(clock, now)
    const score = simulatedScore(item, clock, minute)
    const outcome = settleMarket(item.selectionId, score.home, score.away)
    const quote = simulatedCashoutOffer({
      stakeMinor: 1000,
      potentialReturnMinor: 2200,
      selections: [item],
      clock,
      now,
    })

    if (outcome === false) {
      expect(quote.blocked).toBe(true)
      expect(quote.offer).toBe(0)
    } else {
      expect(quote.blocked).toBe(false)
      expect(quote.offer).toBeGreaterThan(0)
      expect(quote.offer).toBeLessThanOrEqual(2200)
    }
  })

  it('is deterministic for the same clock and selection', () => {
    const item = selection()
    const now = Date.parse('2026-01-01T12:45:00.000Z')
    const input = {
      stakeMinor: 500,
      potentialReturnMinor: 1100,
      selections: [item],
      clock,
      now,
    }
    expect(simulatedCashoutOffer(input)).toEqual(simulatedCashoutOffer(input))
  })
})
