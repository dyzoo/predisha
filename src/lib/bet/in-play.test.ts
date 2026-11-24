import { describe, expect, it } from 'vitest'
import {
  applyInPlayOdds,
  inPlayOddsFactor,
  inPlayQuote,
  liveMatchesForSelections,
} from './in-play'
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

  it('only discounts selections whose own clock has started', () => {
    const liveSelection: TicketSelection = {
      ...selection(),
      simulation: { ...clock },
    }
    const pendingSelection: TicketSelection = {
      ...selection(),
      fixtureId: 'fixture-2',
      kickoffIso: '2026-01-01T19:00:00.000Z',
      simulation: {
        ...clock,
        liveStartedAt: '2026-01-01T19:00:00.000Z',
        kickoffIso: '2026-01-01T19:00:00.000Z',
      },
    }
    const result = applyInPlayOdds(
      [liveSelection, pendingSelection],
      clock,
      Date.parse('2026-01-01T12:30:00.000Z'),
    )
    expect(result.selections[0]?.odds).toBeLessThan(2)
    expect(result.selections[1]?.odds).toBe(2)
    expect(result.selections[1]?.inPlayFactor).toBe(1)
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
    const baseTotal = live.selections.reduce((acc, item) => acc * (item.baseOdds ?? item.odds), 1)
    expect(live.factor).toBeCloseTo(live.totalOdds / baseTotal, 3)
  })
})

describe('live matches', () => {
  const now = new Date('2026-01-01T12:30:00.000Z')

  it('goes live only for the selection whose assigned kickoff has reached', () => {
    const early = { ...selection(), fixtureId: 'early' }
    const late = {
      ...selection(),
      fixtureId: 'late',
      kickoffIso: '2026-01-01T15:00:00.000Z',
    }

    const matches = liveMatchesForSelections([early, late], clock, [], now)

    expect(matches.map(match => match.fixtureId)).toEqual(['early'])
    expect(matches[0]?.label).toBe("31'")
  })

  it('merges an admin live score into the same live row', () => {
    const scored = {
      ...selection(),
      liveScore: { home: 2, away: 1 },
      liveMinute: 37,
    }

    const matches = liveMatchesForSelections([scored], clock, [], now)

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      fixtureId: 'fixture-1',
      minute: 37,
      label: "37'",
      score: { home: 2, away: 1 },
    })
  })
})

