import { describe, expect, it } from 'vitest'
import { computeTicketTotals } from './bets'
import { isSlipFrozen, maskPhone, toAdminSlipView } from './slips'
import { type TicketSelection } from './types'

function selection(odds: number): TicketSelection {
  return {
    fixtureId: `fixture-${odds}`,
    fixtureLabel: 'Home vs Away',
    competition: 'Test League',
    kickoffIso: '2026-01-01T12:00:00.000Z',
    marketId: '1x2',
    marketName: 'Match result',
    selectionId: 'HOME',
    selectionLabel: 'Home',
    odds,
    probability: 0.5,
    result: 'WON',
    finalScore: { home: 1, away: 0 },
    demoResult: true,
  }
}

describe('computeTicketTotals', () => {
  it('combines odds and floors the payout', () => {
    expect(computeTicketTotals(1000, [selection(2), selection(3)])).toEqual({
      totalOdds: 6,
      potentialReturnMinor: 6000,
    })
  })

  it('allows large potential returns without a payout cap', () => {
    expect(computeTicketTotals(500_000, [selection(1000)])).toEqual({
      totalOdds: 1000,
      potentialReturnMinor: 500_000_000,
    })
  })
})

describe('isSlipFrozen', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')

  it('is open before the first kickoff', () => {
    expect(isSlipFrozen({ status: 'OPEN', autoFreezeAt: new Date('2026-01-01T13:00:00.000Z') }, now)).toBe(
      false,
    )
  })

  it('freezes once the first match starts', () => {
    expect(isSlipFrozen({ status: 'OPEN', autoFreezeAt: new Date('2026-01-01T11:59:59.000Z') }, now)).toBe(
      true,
    )
    expect(isSlipFrozen({ status: 'OPEN', autoFreezeAt: now }, now)).toBe(true)
  })

  it('stays frozen when an admin paused it early', () => {
    expect(isSlipFrozen({ status: 'FROZEN', autoFreezeAt: new Date('2026-01-01T13:00:00.000Z') }, now)).toBe(
      true,
    )
  })
})

describe('maskPhone', () => {
  it('keeps the prefix and last two digits only', () => {
    expect(maskPhone('0712345678')).toBe('07123•••78')
    expect(maskPhone('+255 712 345 678')).toBe('25571•••78')
  })

  it('returns short numbers unchanged', () => {
    expect(maskPhone('12345')).toBe('12345')
  })
})

describe('toAdminSlipView', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')

  it('maps stored fields and auto-freezes expired slips', () => {
    const view = toAdminSlipView(
      {
        id: 'slip-1',
        code: 'ABC123',
        title: 'Weekend banker',
        mode: 'SANDBOX',
        selections: [selection(1.5)] as never,
        totalOdds: 1.5,
        stakeMinor: 1000,
        potentialReturnMinor: 1500,
        status: 'OPEN',
        freezeReason: null,
        autoFreezeAt: new Date('2026-01-01T11:00:00.000Z'),
        frozenAt: null,
        frozenBy: null,
        createdBy: 'admin-1',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
      now,
    )

    expect(view).toMatchObject({
      code: 'ABC123',
      mode: 'SANDBOX',
      frozen: true,
      frozenReason: 'Betting closed because the first match has started.',
      autoFreezeAt: '2026-01-01T11:00:00.000Z',
    })
    expect(view.selections).toHaveLength(1)
  })

  it('keeps an admin freeze reason while still open', () => {
    const view = toAdminSlipView(
      {
        id: 'slip-2',
        code: 'XYZ789',
        title: null,
        mode: 'LIVE',
        selections: [] as never,
        totalOdds: 1,
        stakeMinor: 500,
        potentialReturnMinor: 500,
        status: 'FROZEN',
        freezeReason: 'Paused by an administrator.',
        autoFreezeAt: new Date('2026-01-02T12:00:00.000Z'),
        frozenAt: now,
        frozenBy: 'admin-1',
        createdBy: 'admin-1',
        createdAt: now,
        updatedAt: now,
      },
      now,
    )

    expect(view.frozen).toBe(true)
    expect(view.frozenReason).toBe('Paused by an administrator.')
  })
})
