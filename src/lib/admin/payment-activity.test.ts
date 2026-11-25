import { describe, expect, it } from 'vitest'
import {
  buildPaymentActivity,
  normalizePaymentStatus,
  readJsonNumber,
  readJsonRecord,
  readJsonString,
  type PaymentActivityInput,
} from './payment-activity'

describe('admin payment activity', () => {
  it('normalizes provider and admin statuses', () => {
    expect(normalizePaymentStatus('SUCCEEDED')).toBe('PAID')
    expect(normalizePaymentStatus('PAID')).toBe('PAID')
    expect(normalizePaymentStatus('PENDING_AUTH')).toBe('PENDING')
    expect(normalizePaymentStatus('CANCELLED')).toBe('FAILED')
    expect(normalizePaymentStatus(null)).toBe('UNKNOWN')
  })

  it('reads billing metadata safely', () => {
    const metadata = readJsonRecord({
      phone: '+255712345678',
      amountMinor: 4200,
      currency: 'TZS',
    })
    expect(readJsonString(metadata.phone)).toBe('+255712345678')
    expect(readJsonNumber(metadata.amountMinor)).toBe(4200)
    expect(readJsonString(metadata.currency)).toBe('TZS')
    expect(readJsonRecord(null)).toEqual({})
  })

  it('sorts newest first and keeps client phone numbers', () => {
    const rows: PaymentActivityInput[] = [
      {
        id: 'old',
        kind: 'SHARED_SLIP',
        client: 'Asha',
        phone: '255788000111',
        amountMinor: 2000,
        currency: 'TZS',
        provider: 'settlopay',
        reference: 'slip-old',
        status: 'CANCELLED',
        createdAt: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 'new',
        kind: 'DEPOSIT',
        client: 'Juma',
        phone: '+255712345678',
        amountMinor: 5000,
        currency: 'TZS',
        provider: 'settlopay',
        reference: 'pi_new',
        status: 'SUCCEEDED',
        createdAt: '2026-11-24T10:00:00.000Z',
      },
      {
        id: 'missing-phone',
        kind: 'SUBSCRIPTION',
        client: null,
        phone: null,
        amountMinor: null,
        currency: 'USD',
        provider: null,
        reference: null,
        status: 'PENDING_AUTH',
        createdAt: '2026-11-25T10:00:00.000Z',
      },
    ]

    const activity = buildPaymentActivity(rows)

    expect(activity.map(item => item.id)).toEqual(['missing-phone', 'new', 'old'])
    expect(activity[1]?.phone).toBe('+255712345678')
    expect(activity[1]?.status).toBe('PAID')
    expect(activity[1]?.amount).toContain('TZS')
    expect(activity[0]?.phone).toBe('Not provided')
    expect(activity[0]?.client).toBe('Unknown client')
    expect(activity[2]?.status).toBe('FAILED')
  })
})
