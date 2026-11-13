import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  entry: null as Record<string, unknown> | null,
  slip: null as Record<string, unknown> | null,
  ticket: null as Record<string, unknown> | null,
  claimCount: 1,
  createFails: false,
  updateMany: vi.fn(),
  update: vi.fn(),
  findEntry: vi.fn(),
  findSlip: vi.fn(),
  findTicket: vi.fn(),
  createTicket: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const adminBetEntry = {
    findUnique: state.findEntry,
    updateMany: state.updateMany,
    update: state.update,
  }
  const adminBetSlip = { findUnique: state.findSlip }
  const betTicket = { findUnique: state.findTicket, create: state.createTicket }
  const client = { adminBetEntry, adminBetSlip, betTicket }

  return {
    prisma: {
      ...client,
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(client)),
    },
  }
})

import { BetError } from './errors'
import { placeAdminSlipBet } from './slips'
import type { TicketSelection } from './types'

const selection: TicketSelection = {
  fixtureId: 'fixture-1',
  fixtureLabel: 'Home vs Away',
  competition: 'Test League',
  kickoffIso: '2026-01-01T12:00:00.000Z',
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

function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    slipId: 'slip-1',
    userId: 'user-1',
    phone: '255712345678',
    stakeMinor: 1000,
    status: 'PAID',
    provider: 'harakapay',
    providerOrderId: 'HP1',
    ticketId: null,
    placementStartedAt: null,
    failureReason: null,
    paidAt: new Date('2026-01-01T11:00:00.000Z'),
    createdAt: new Date('2026-01-01T11:00:00.000Z'),
    updatedAt: new Date('2026-01-01T11:00:00.000Z'),
    ...overrides,
  }
}

function baseSlip() {
  return {
    id: 'slip-1',
    code: 'ABC123',
    title: null,
    mode: 'LIVE',
    selections: [selection],
    totalOdds: 2,
    stakeMinor: 1000,
    potentialReturnMinor: 2000,
    status: 'OPEN',
    freezeReason: null,
    autoFreezeAt: new Date('2026-01-01T13:00:00.000Z'),
    frozenAt: null,
    frozenBy: null,
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  }
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    userId: 'user-1',
    code: 'TCK12345',
    stakeMinor: 1000,
    totalOdds: 2,
    potentialReturnMinor: 2000,
    status: 'OPEN',
    payoutMinor: 0,
    cashoutMinor: null,
    selectionCount: 1,
    selections: [selection],
    placedAt: new Date('2026-01-01T12:00:00.000Z'),
    settledAt: null,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-01T12:00:00.000Z'),
    ...overrides,
  }
}

beforeEach(() => {
  state.entry = baseEntry()
  state.slip = baseSlip()
  state.ticket = null
  state.claimCount = 1
  state.createFails = false

  state.updateMany.mockReset()
  state.updateMany.mockImplementation(async () => ({ count: state.claimCount }))
  state.update.mockReset()
  state.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    state.entry = { ...(state.entry ?? {}), ...data }
    return state.entry
  })
  state.findEntry.mockReset()
  state.findEntry.mockImplementation(async () => state.entry)
  state.findSlip.mockReset()
  state.findSlip.mockImplementation(async () => state.slip)
  state.findTicket.mockReset()
  state.findTicket.mockImplementation(async ({ where }: { where: { id?: string; code?: string } }) => {
    if (!state.ticket) return null
    if (where.id && state.ticket.id !== where.id) return null
    if (where.code && state.ticket.code !== where.code) return null
    return state.ticket
  })
  state.createTicket.mockReset()
  state.createTicket.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    if (state.createFails) throw new Error('db write failed')
    state.ticket = ticket({ ...data, selections: data.selections })
    return state.ticket
  })
})

describe('placeAdminSlipBet', () => {
  it('returns the already placed ticket without claiming again', async () => {
    state.entry = baseEntry({ ticketId: 'ticket-1' })
    state.ticket = ticket()

    const result = await placeAdminSlipBet({ entryId: 'entry-1' })

    expect(result?.code).toBe('TCK12345')
    expect(state.updateMany).not.toHaveBeenCalled()
    expect(state.createTicket).not.toHaveBeenCalled()
  })

  it('skips placement when another worker already claimed the entry', async () => {
    state.claimCount = 0

    const result = await placeAdminSlipBet({ entryId: 'entry-1' })

    expect(result).toBeNull()
    expect(state.createTicket).not.toHaveBeenCalled()
  })

  it('claims the entry once and links the new ticket to it', async () => {
    const result = await placeAdminSlipBet({ entryId: 'entry-1' })

    expect(state.updateMany).toHaveBeenCalledTimes(1)
    expect(state.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'entry-1', status: 'PAID', ticketId: null }),
      }),
    )
    expect(state.createTicket).toHaveBeenCalledTimes(1)
    expect(state.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stakeMinor: 1000, totalOdds: 2, potentialReturnMinor: 2000 }),
      }),
    )
    expect(result?.id).toBe('ticket-1')
    expect(result?.code).toBe(state.ticket?.code)
    expect(state.entry).toMatchObject({ ticketId: 'ticket-1' })
  })

  it('marks the entry failed when the ticket cannot be created', async () => {
    state.createFails = true

    await expect(placeAdminSlipBet({ entryId: 'entry-1' })).rejects.toThrow('db write failed')

    expect(state.entry).toMatchObject({ status: 'FAILED', failureReason: 'BET_FAILED' })
  })

  it('refuses entries that are not paid yet', async () => {
    state.entry = baseEntry({ status: 'PENDING' })

    await expect(placeAdminSlipBet({ entryId: 'entry-1' })).rejects.toBeInstanceOf(BetError)
    expect(state.updateMany).not.toHaveBeenCalled()
  })
})
