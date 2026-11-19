import { describe, expect, it } from 'vitest'
import { buildCashoutQuote } from './cashout'

describe('buildCashoutQuote', () => {
  it('offers most of the potential return when every selection is winning', () => {
    const quote = buildCashoutQuote({
      stakeMinor: 1000,
      potentialReturnMinor: 4000,
      outcome: 'WIN',
      progress: 0.8,
      seed: 'TEST',
      now: 1_700_000_000_000,
    })
    expect(quote.blocked).toBe(false)
    expect(quote.offer).toBeGreaterThan(3000)
    expect(quote.offer).toBeLessThanOrEqual(4000)
  })

  it('returns a stake-backed offer when a selection is losing', () => {
    const quote = buildCashoutQuote({
      stakeMinor: 1000,
      potentialReturnMinor: 4000,
      outcome: 'LOSE',
      progress: 0.8,
      seed: 'TEST',
      now: 1_700_000_000_000,
    })
    expect(quote.blocked).toBe(false)
    expect(quote.offer).toBeGreaterThanOrEqual(400)
    expect(quote.offer).toBeLessThanOrEqual(1000)
  })

  it('never exceeds the gross return', () => {
    const quote = buildCashoutQuote({
      stakeMinor: 500,
      potentialReturnMinor: 900,
      outcome: 'MIXED',
      progress: 1,
      seed: 'TEST',
      now: 1_700_000_000_000,
    })
    expect(quote.offer).toBeLessThanOrEqual(900)
  })
})
