import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  entry: null as Record<string, unknown> | null,
  slipRecord: null as Record<string, unknown> | null,
  slipView: null as Record<string, unknown> | null,
  ticket: null as Record<string, unknown> | null,
  frozen: false,
  keyConfigured: true,
  placeError: null as Error | null,
  slipByCode: vi.fn(),
  isFrozen: vi.fn(),
  place: vi.fn(),
  createEntry: vi.fn(),
  findEntry: vi.fn(),
  findEntryOrThrow: vi.fn(),
  updateEntry: vi.fn(),
  updateManyEntry: vi.fn(),
  findTicket: vi.fn(),
  findManyTicket: vi.fn(),
  findSlip: vi.fn(),
  createOrder: vi.fn(),
  orderStatus: vi.fn(),
  key: vi.fn(),
}))

vi.mock('./slips', () => ({
  getAdminBetSlipByCode: state.slipByCode,
  isSlipFrozen: state.isFrozen,
  maskPhone: (phone: string) => `masked:${phone}`,
  toAdminSlipView: vi.fn(),
  placeAdminSlipBet: state.place,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminBetSlip: { findUnique: state.findSlip, findUniqueOrThrow: state.findSlip },
    adminBetEntry: {
      create: state.createEntry,
      findUnique: state.findEntry,
      findUniqueOrThrow: state.findEntryOrThrow,
      update: state.updateEntry,
      updateMany: state.updateManyEntry,
    },
    betTicket: { findUnique: state.findTicket, findMany: state.findManyTicket },
  },
}))

vi.mock('@/lib/billing/harakapay', () => ({
  HARAKAPAY_PROVIDER_NAME: 'harakapay',
  createHarakaPayOrder: state.createOrder,
  getHarakaPayOrderStatus: state.orderStatus,
  harakapayApiKeyConfigured: state.key,
}))

import { BetError } from './errors'
import {
  applySlipPaymentEvent,
  refreshSlipPaymentEntry,
  retrySlipEntry,
  startSlipPayment,
} from './slip-payments'

function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    slipId: 'slip-1',
    userId: 'user-1',
    phone: '255712345678',
    stakeMinor: 1000,
    status: 'PENDING',
    provider: 'harakapay',
    providerOrderId: 'HP1',
    ticketId: null,
    placementStartedAt: null,
    failureReason: null,
    paidAt: null,
    createdAt: new Date('2026-01-01T11:00:00.000Z'),
    updatedAt: new Date('2026-01-01T11:00:00.000Z'),
    ...overrides,
  }
}

function baseSlip(mode: 'LIVE' | 'SANDBOX' = 'LIVE') {
  return {
    id: 'slip-1',
    code: 'ABC123',
    mode,
    status: 'OPEN',
    stakeMinor: 1000,
    freezeReason: null,
    autoFreezeAt: new Date('2099-01-01T13:00:00.000Z'),
  }
}

function slipView(mode: 'LIVE' | 'SANDBOX' = 'LIVE') {
  return {
    id: 'slip-1',
    code: 'ABC123',
    title: null,
    mode,
    status: 'OPEN',
    frozen: false,
    frozenReason: null,
    autoFreezeAt: '2099-01-01T13:00:00.000Z',
    createdAt: '2026-01-01T10:00:00.000Z',
    stakeMinor: 1000,
    totalOdds: 2,
    potentialReturnMinor: 2000,
    selections: [],
  }
}

function webhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'harakapay',
    providerEventId: 'evt-1',
    type: 'payment',
    status: 'completed',
    orderId: 'HP1',
    amountMinor: 1000,
    currency: 'TZS',
    verified: true,
    ...overrides,
  } as Parameters<typeof applySlipPaymentEvent>[0]
}

beforeEach(() => {
  state.entry = null
  state.slipRecord = baseSlip()
  state.slipView = slipView()
  state.ticket = { id: 'ticket-1', code: 'TCK12345' }
  state.frozen = false
  state.keyConfigured = true
  state.placeError = null

  state.slipByCode.mockReset()
  state.slipByCode.mockImplementation(async () => state.slipView)
  state.isFrozen.mockReset()
  state.isFrozen.mockImplementation(() => state.frozen)
  state.place.mockReset()
  state.place.mockImplementation(async ({ entryId }: { entryId: string }) => {
    if (state.placeError) throw state.placeError
    if (state.entry) {
      state.entry = { ...state.entry, status: 'PAID', ticketId: 'ticket-1' }
    }
    return { id: 'ticket-1', code: 'TCK12345', entryId }
  })

  state.createEntry.mockReset()
  state.createEntry.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    state.entry = baseEntry(data)
    return state.entry
  })
  state.findEntry.mockReset()
  state.findEntry.mockImplementation(async () => state.entry)
  state.findEntryOrThrow.mockReset()
  state.findEntryOrThrow.mockImplementation(async () => {
    if (!state.entry) throw new Error('missing entry')
    return state.entry
  })
  state.updateEntry.mockReset()
  state.updateEntry.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    state.entry = { ...(state.entry ?? {}), ...data }
    return state.entry
  })
  state.updateManyEntry.mockReset()
  state.updateManyEntry.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      if (state.entry) state.entry = { ...state.entry, ...data }
      return { count: 1 }
    },
  )
  state.findTicket.mockReset()
  state.findTicket.mockImplementation(async () => state.ticket)
  state.findManyTicket.mockReset()
  state.findManyTicket.mockImplementation(async () => [])
  state.findSlip.mockReset()
  state.findSlip.mockImplementation(async () => state.slipRecord)

  state.createOrder.mockReset()
  state.createOrder.mockImplementation(async () => ({ success: true, orderId: 'HP1' }))
  state.orderStatus.mockReset()
  state.orderStatus.mockImplementation(async () => ({ status: 'completed' }))
  state.key.mockReset()
  state.key.mockImplementation(() => state.keyConfigured)
})

describe('startSlipPayment', () => {
  it('places a sandbox entry immediately and exposes the ticket code', async () => {
    state.slipRecord = baseSlip('SANDBOX')
    state.slipView = slipView('SANDBOX')

    const result = await startSlipPayment({ code: 'ABC123', phone: '0712345678', userId: 'user-1' })

    expect(result.entry.status).toBe('PAID')
    expect(result.entry.ticketId).toBe('ticket-1')
    expect(result.entry.ticketCode).toBe('TCK12345')
    expect(result.mode).toBe('SANDBOX')
    expect(state.place).toHaveBeenCalledTimes(1)
    expect(state.createOrder).not.toHaveBeenCalled()
  })

  it('rejects a frozen slip before creating an entry', async () => {
    state.frozen = true

    await expect(
      startSlipPayment({ code: 'ABC123', phone: '0712345678', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'SLIP_FROZEN' })
    expect(state.createEntry).not.toHaveBeenCalled()
  })

  it('returns 503 when HarakaPay is not configured in live mode', async () => {
    state.keyConfigured = false

    await expect(
      startSlipPayment({ code: 'ABC123', phone: '0712345678', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE' })
    expect(state.createEntry).not.toHaveBeenCalled()
  })

  it('creates a pending HarakaPay entry in live mode', async () => {
    const result = await startSlipPayment({ code: 'ABC123', phone: '0712345678', userId: 'user-1' })

    expect(result.entry.status).toBe('PENDING')
    expect(result.entry.providerOrderId).toBe('HP1')
    expect(result.mode).toBe('LIVE')
    expect(state.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          provider: 'harakapay',
          providerOrderId: 'HP1',
        }),
      }),
    )
    expect(state.place).not.toHaveBeenCalled()
  })
})

describe('refreshSlipPaymentEntry', () => {
  it('confirms a successful payment, places the bet once, and returns the ticket code', async () => {
    state.entry = baseEntry()

    const entry = await refreshSlipPaymentEntry('entry-1')

    expect(entry.status).toBe('PAID')
    expect(entry.ticketId).toBe('ticket-1')
    expect(entry.ticketCode).toBe('TCK12345')
    expect(state.orderStatus).toHaveBeenCalledWith('HP1')
    expect(state.place).toHaveBeenCalledTimes(1)
  })

  it('marks the entry failed when the provider reports a failure', async () => {
    state.entry = baseEntry()
    state.orderStatus.mockResolvedValue({ status: 'failed' })

    const entry = await refreshSlipPaymentEntry('entry-1')

    expect(entry.status).toBe('FAILED')
    expect(state.place).not.toHaveBeenCalled()
  })

  it('heals a paid entry that never got a ticket', async () => {
    state.entry = baseEntry({ status: 'PAID', paidAt: new Date() })

    const entry = await refreshSlipPaymentEntry('entry-1')

    expect(entry.ticketId).toBe('ticket-1')
    expect(state.place).toHaveBeenCalledTimes(1)
    expect(state.orderStatus).not.toHaveBeenCalled()
  })
})

describe('applySlipPaymentEvent', () => {
  it('does not place a second ticket for an already paid entry', async () => {
    state.entry = baseEntry({ status: 'PAID', ticketId: 'ticket-1' })

    const result = await applySlipPaymentEvent(webhookEvent())

    expect(result.handled).toBe(true)
    expect(state.place).not.toHaveBeenCalled()
  })

  it('places a ticket when the webhook confirms a pending entry', async () => {
    state.entry = baseEntry()

    const result = await applySlipPaymentEvent(webhookEvent({ status: 'success' }))

    expect(result.handled).toBe(true)
    expect(state.place).toHaveBeenCalledTimes(1)
  })
})

describe('retrySlipEntry', () => {
  it('retries a failed sandbox placement without a second charge', async () => {
    state.entry = baseEntry({
      status: 'FAILED',
      provider: 'sandbox',
      providerOrderId: null,
      failureReason: 'INSUFFICIENT_FUNDS',
    })

    const entry = await retrySlipEntry('entry-1')

    expect(entry.status).toBe('PAID')
    expect(entry.ticketId).toBe('ticket-1')
    expect(state.place).toHaveBeenCalledTimes(1)
    expect(state.updateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', failureReason: null }),
      }),
    )
  })

  it('refuses to retry when the HarakaPay payment was not confirmed', async () => {
    state.entry = baseEntry({ status: 'FAILED', failureReason: 'BET_FAILED' })
    state.orderStatus.mockResolvedValue({ status: 'pending' })

    await expect(retrySlipEntry('entry-1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_CONFIRMED',
    })
    expect(state.place).not.toHaveBeenCalled()
  })

  it('rejects entries that are still pending', async () => {
    state.entry = baseEntry()

    await expect(retrySlipEntry('entry-1')).rejects.toBeInstanceOf(BetError)
    expect(state.place).not.toHaveBeenCalled()
  })
})
