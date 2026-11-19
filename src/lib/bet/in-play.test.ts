import { describe, expect, it } from 'vitest'
import { applyInPlayOdds, inPlayOddsFactor, inPlayQuote } from './in-play'
import type { TicketSelection, TicketSimulationMeta } from './types'

const clock: TicketSimulationMeta = {
  liveStartedAt: '2026-01-01T12:00:00.000Z',
  durationMinutes: 90,
  seed: 'TEST12',
  kickoffIso: '2026-01-01T12:00:00.000Z',
}

function selection(): TicketSelection {
  return {
    fixtureId: 'fixture-1',
    fixtureLabel: 'Home vs Away',
    competition: 'Test League',
    kickoffIso: clock.kickoffIso,
    marketId: '1x2',
    marketName: 'Match result',
    selectionId: 'HOME',
    selectionLabel: 'Home',
    odds: 2,
    probability: 0.5,
    result: 'PENDING',
    finalScore: null,
    demoResult: false,
  }
}

describe('in-play odds', () => {
  it('reduces odds as the match progresses', () => {
    expect(inPlayOddsFactor(0)).toBe(1)
    expect(inPlayOddsFactor(0.5)).toBeCloseTo(0.725)
    expect(inPlayOddsFactor(1)).toBe(0.45)
  })

  it('always uses the original price as the in-play base', () => {
    const early = applyInPlayOdds([selection()], clock, Date.parse(clock.liveStartedAt))
    const late = applyInPlayOdds(
      early.selections,
      clock,
      Date.parse(clock.liveStartedAt) + 80 * 60_000,
    )
    expect(late.selections[0]?.baseOdds).toBe(2)
    expect(late.selections[0]?.odds).toBeLessThan(early.selections[0]?.odds ?? 0)
  })

  it('lowers the payout for a stake placed after kickoff', () => {
    const pre = inPlayQuote(1000, [selection()], null)
    const live = inPlayQuote(
      1000,
      [selection()],
      clock,
      Date.parse(clock.liveStartedAt) + 45 * 60_000,
    )
    expect(live.totalOdds).toBeLessThan(pre.totalOdds)
    expect(live.potentialReturnMinor).toBeLessThan(pre.potentialReturnMinor)
    expect(live.netPayoutMinor).toBeLessThan(pre.netPayoutMinor)
  })
})
