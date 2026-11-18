import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildBetTransactionSms,
  normalizeNextSmsNumbers,
  sendBetTransactionSms,
  sendNextSms,
} from './nextsms'

const { findUserMock, auditCreateMock } = vi.hoisted(() => ({
  findUserMock: vi.fn(),
  auditCreateMock: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: findUserMock },
    adminAuditLog: { create: auditCreateMock },
  },
}))

describe('nextsms helpers', () => {
  beforeEach(() => {
    auditCreateMock.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('normalizes and de-duplicates recipient numbers', () => {
    expect(normalizeNextSmsNumbers(['0712345678', '+255712345678', '255712345678'])).toEqual([
      '255712345678',
    ])
  })

  it('reports the provider rejection reason for a bad sender ID', async () => {
    vi.stubEnv('NEXTSMS_SENDER_ID', 'NEXTSMS')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            messageId: 'msg-1',
            status: {
              groupName: 'REJECTED',
              name: 'REJECTED_SOURCE',
              description: 'Sender ID in the request not registered on your account.',
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendNextSms({ to: ['0712345678'], text: 'Test message' })

    expect(result).toMatchObject({ success: false, sentCount: 0, failedCount: 1 })
    expect(result.error).toContain('REJECTED_SOURCE')
    expect(result.error).toContain('not registered')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://messaging-service.co.tz/api/sms/v2/text/single',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('treats an accepted message as sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ messageId: 'msg-2', status: { groupName: 'ACCEPTED', name: 'SUCCESS' } }],
        }),
      }),
    )

    await expect(sendNextSms({ to: ['255712345678'], text: 'Hello' })).resolves.toMatchObject({
      success: true,
      sentCount: 1,
      failedCount: 0,
      error: null,
      messageIds: ['msg-2'],
    })
  })

  it('describes deposits and stakes differently', () => {
    const deposit = buildBetTransactionSms({ amountMinor: 10000, source: 'deposit' })
    const stake = buildBetTransactionSms({ amountMinor: 5000, source: 'shared_slip' })
    const aviator = buildBetTransactionSms({ amountMinor: 2000, source: 'aviator' })

    expect(deposit).toContain('was added to your account from your deposit.')
    expect(stake).toContain('was staked on your bet slip.')
    expect(aviator).toContain('was staked on Aviator.')
    expect(stake).not.toContain('was added')
  })

  it('sends deposit notifications to the user phone', async () => {
    findUserMock.mockResolvedValue({ phone: '0712 345 678' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ messageId: 'msg-3', status: { groupName: 'ACCEPTED', name: 'SUCCESS' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendBetTransactionSms({
      userId: 'user-1',
      amountMinor: 10000,
      source: 'deposit',
      reference: 'order-1',
    })

    expect(result.success).toBe(true)
    const request = fetchMock.mock.calls[0]?.[1] as { body: string }
    expect(JSON.parse(request.body).to).toEqual(['255712345678'])
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'bet.sms.sent',
          metadata: expect.objectContaining({ phone: expect.stringContaining('•••') }),
        }),
      }),
    )
  })

  it('skips the SMS when the user has no phone number', async () => {
    findUserMock.mockResolvedValue({ phone: null })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendBetTransactionSms({
      userId: 'user-2',
      amountMinor: 5000,
      source: 'shared_slip',
      reference: 'ticket:ABC:stake',
    })

    expect(result).toMatchObject({ success: false, sentCount: 0, failedCount: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'bet.sms.skipped' }),
      }),
    )
  })
})
