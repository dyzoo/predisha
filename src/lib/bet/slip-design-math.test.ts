import { describe, expect, it } from 'vitest'
import { calculateSlipTotals } from './slip-design-math'
import { slipDesignInputSchema } from './slip-designs'

const selection = {
  id: 'match-1',
  time: '1:00 pm, Wed 18/11',
  home: 'Home',
  away: 'Away',
  league: 'League',
  selection: '1X2 - Home',
  won: false,
  fixtureId: null,
  finalScore: '',
}

describe('slip design totals', () => {
  it('multiplies odds and applies stake, bonus and withholding tax', () => {
    const totals = calculateSlipTotals([2, 1.5], 500, 100, 15)
    expect(totals.totalOdds).toBe(3)
    expect(totals.winningsMinor).toBe(1000)
    expect(totals.taxMinor).toBe(165)
    expect(totals.payoutMinor).toBe(1435)
  })

  it('treats invalid odds as single odds and never returns a negative payout', () => {
    const totals = calculateSlipTotals([Number.NaN, 0], 500, 0, 15)
    expect(totals.totalOdds).toBe(1)
    expect(totals.winningsMinor).toBe(0)
    expect(totals.payoutMinor).toBe(500)
  })
})

describe('slip design validation', () => {
  const input = {
    title: 'Saturday slip',
    status: 'DRAFT',
    stakeMinor: 500,
    bonusMinor: 0,
    taxPercent: 15,
    reuseCount: 1,
    selections: [{ ...selection, odds: 1.5 }],
  }

  it('accepts a normal slip', () => {
    expect(slipDesignInputSchema.safeParse(input).success).toBe(true)
  })

  it('accepts won selections and rejects bad odds or too many picks', () => {
    expect(
      slipDesignInputSchema.safeParse({
        ...input,
        status: 'WON',
        selections: [{ ...selection, odds: 1.5, won: true, finalScore: '2 - 1' }],
      }).success,
    ).toBe(true)
    expect(
      slipDesignInputSchema.safeParse({
        ...input,
        selections: [{ ...selection, odds: 0.5 }],
      }).success,
    ).toBe(false)
    expect(
      slipDesignInputSchema.safeParse({
        ...input,
        selections: Array.from({ length: 21 }, (_, index) => ({ ...selection, id: `m-${index}`, odds: 1.5 })),
      }).success,
    ).toBe(false)
  })
})
