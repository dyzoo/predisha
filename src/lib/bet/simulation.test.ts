import { describe, expect, it } from 'vitest'
import { settleMarket } from './odds'
import {
  autoWinResultsForTicket,
  attachSimulationClock,
  simulatedCashoutOffer,
  simulatedFinalScore,
  simulatedResultsForTicket,
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

  it('attaches the same clock to selections with the same kickoff', () => {
    const attached = attachSimulationClock([selection(), selection()], clock)
    expect(attached).toHaveLength(2)
    expect(attached[0]?.simulation).toEqual(clock)
    expect(attached[1]?.simulation).toEqual(clock)
  })

  it('starts each selection at its own kickoff', () => {
    const early = {
      ...selection(),
      fixtureId: 'random-early',
      kickoffIso: '2026-01-01T12:00:00.000Z',
    }
    const late = {
      ...selection(),
      fixtureId: 'random-late',
      kickoffIso: '2026-01-01T15:00:00.000Z',
    }
    const [earlyAttached, lateAttached] = attachSimulationClock([early, late], clock)
    const now = Date.parse('2026-01-01T12:30:00.000Z')

    expect(simulationIsLive(earlyAttached!.simulation!, now)).toBe(true)
    expect(simulationIsLive(lateAttached!.simulation!, now)).toBe(false)
  })
})

describe('simulated results', () => {
  it('ends an over 2.5 selection with a score that satisfies the market', () => {
    const item = {
      ...selection(),
      marketId: 'total-goals',
      marketName: 'Total goals',
      selectionId: 'OVER_2_5',
      selectionLabel: 'Over 2.5 goals',
    }
    const final = simulatedFinalScore(item, clock)
    expect(settleMarket(item.selectionId, final.home, final.away)).toBe(true)
    expect(simulatedScore(item, clock, clock.durationMinutes)).toEqual(final)
  })

  it('feeds simulated final scores into settlement results', () => {
    const item = {
      ...selection(),
      marketId: 'total-goals',
      marketName: 'Total goals',
      selectionId: 'OVER_2_5',
      selectionLabel: 'Over 2.5 goals',
    }
    const final = simulatedFinalScore(item, clock)
    const liveItem = attachSimulationClock([item], clock)[0]
    const results = simulatedResultsForTicket(
      liveItem ? [liveItem] : [],
      new Map(),
      Date.parse('2026-01-01T14:00:00.000Z'),
    )
    expect(results.get(item.fixtureId)).toEqual({
      status: 'FINISHED',
      homeScore: final.home,
      awayScore: final.away,
    })
  })

  it('does not override provider fixtures with simulated scores', () => {
    const item = { ...selection(), fixtureId: '12345' }
    const liveItem = attachSimulationClock([item], clock)[0]
    const results = simulatedResultsForTicket(
      liveItem ? [liveItem] : [],
      new Map(),
      Date.parse('2026-01-01T14:00:00.000Z'),
    )

    expect(results.has(item.fixtureId)).toBe(false)
  })

  it('auto-wins only selections whose kickoff has reached full time', () => {
    const early = { ...selection(), fixtureId: 'early' }
    const late = {
      ...selection(),
      fixtureId: 'late',
      kickoffIso: '2026-01-01T15:00:00.000Z',
    }
    const results = autoWinResultsForTicket(
      [early, late],
      new Map(),
      Date.parse('2026-01-01T14:00:00.000Z'),
    )

    expect(results.get('early')?.autoWin).toBe(true)
    expect(results.get('early')?.status).toBe('FINISHED')
    expect(results.has('late')).toBe(false)
  })
})

describe('simulated cashout', () => {
  it('favors a projected winner with a stake floor and growing profit share', () => {
    const item = selection()
    const input = {
      stakeMinor: 1000,
      potentialReturnMinor: 2200,
      selections: [item],
      clock,
    }
    const early = simulatedCashoutOffer({
      ...input,
      now: Date.parse('2026-01-01T12:05:00.000Z'),
    })
    const late = simulatedCashoutOffer({
      ...input,
      now: Date.parse('2026-01-01T12:50:00.000Z'),
    })
    expect(early.offer).toBeGreaterThanOrEqual(1000)
    expect(late.offer).toBeGreaterThan(early.offer)
    expect(late.offer).toBeLessThanOrEqual(2200)
  })

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

    expect(quote.blocked).toBe(false)
    expect(quote.offer).toBeGreaterThan(0)
    expect(quote.offer).toBeLessThanOrEqual(2200)
    const expectedMinimum = outcome === false ? Math.floor(1000 * 0.4) : 1000
    expect(quote.offer).toBeGreaterThanOrEqual(expectedMinimum)
  })

  it('blocks the offer until the selection kickoff has passed', () => {
    const item = {
      ...selection(),
      kickoffIso: '2026-01-01T15:00:00.000Z',
    }
    const quote = simulatedCashoutOffer({
      stakeMinor: 1000,
      potentialReturnMinor: 2200,
      selections: [item],
      clock,
      now: Date.parse('2026-01-01T14:00:00.000Z'),
    })
    expect(quote.blocked).toBe(true)
    expect(quote.offer).toBe(0)
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
