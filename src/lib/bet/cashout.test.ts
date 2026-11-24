import { describe, expect, it } from 'vitest'
import { cashoutOffer } from './bets'
import { buildCashoutQuote } from './cashout'
import type { TicketSelection } from './types'

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

describe('cashoutOffer', () => {
  const ticket = { stakeMinor: 1000, potentialReturnMinor: 2200, code: 'TEST12' }

  it('opens an offer when an admin sets a live score before the catalog kickoff', () => {
    const selection: TicketSelection = {
      fixtureId: '12345',
      fixtureLabel: 'Home vs Away',
      competition: 'Test League',
      kickoffIso: '2026-01-01T15:00:00.000Z',
      marketId: '1x2',
      marketName: 'Match result',
      selectionId: 'HOME',
      selectionLabel: 'Home',
      odds: 2.2,
      probability: 0.45,
      result: 'PENDING',
      finalScore: null,
      liveScore: { home: 1, away: 0 },
      liveMinute: 12,
      demoResult: false,
    }

    const quote = cashoutOffer(
      ticket,
      [selection],
      new Map(),
      new Map(),
      new Date('2026-01-01T12:00:00.000Z'),
    )

    expect(quote.blocked).toBe(false)
    expect(quote.offer).toBeGreaterThan(0)
  })
})
