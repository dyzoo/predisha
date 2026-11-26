import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSettloOrder,
  getSettloPayment,
  mapSettloState,
  parseSettloWebhookEvent,
  verifySettloWebhook,
  verifySettloWebhookSignature,
} from './settlopay'

function sign(rawBody: string, secret = 'whsec_test', t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  return `t=${t},v1=${v1}`
}

describe('settlopay helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('verifies webhook signatures when a secret is configured', () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ id: 'evt-1', type: 'payment_intent.succeeded' })
    expect(verifySettloWebhookSignature(rawBody, sign(rawBody))).toBe(true)
    expect(verifySettloWebhookSignature(rawBody, 't=1,v1=deadbeef')).toBe(false)
  })

  it('rejects invalid or missing signatures', () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    expect(verifySettloWebhookSignature('payload', null)).toBe(false)
    expect(verifySettloWebhookSignature('payload', 'bad')).toBe(false)
  })

  it('parses webhook payloads without a provider call', () => {
    const rawBody = JSON.stringify({
      id: 'evt-3',
      type: 'payment_intent.succeeded',
      status: 'SUCCEEDED',
      data: { id: 'pi_pay4', amount: { value: 4200 }, currency: 'TZS' },
    })

    expect(parseSettloWebhookEvent(rawBody, 'evt-3')).toMatchObject({
      provider: 'settlopay',
      providerEventId: 'evt-3',
      orderId: 'pi_pay4',
      status: 'SUCCEEDED',
      amountMinor: 4200,
      verified: true,
    })
  })

  it('maps Settlo states to local outcomes', () => {
    expect(mapSettloState('SUCCEEDED')).toBe('PAID')
    expect(mapSettloState('PENDING_AUTH')).toBe('PENDING')
    expect(mapSettloState('CANCELLED')).toBe('FAILED')
  })

  it('creates a mobile-money payment through the payments endpoint', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'setlo_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'pi_pay1', state: 'PENDING_AUTH', amount: { value: 1000, currency: 'TZS' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createSettloOrder({
      phone: '+255712345678',
      amountMinor: 1000,
      currency: 'TZS',
      description: 'test',
    })

    expect(result).toMatchObject({ success: true, orderId: 'pi_pay1', status: 'PENDING_AUTH', amount: 1000 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.settlopay.co.tz/v1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer setlo_test',
          'Settlo-Version': '2026-04-29',
          'Idempotency-Key': expect.any(String),
        }),
      }),
    )
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({
      amount: { value: 1000, currency: 'TZS' },
      method: 'mobile_money',
      method_data: { phone: '+255712345678' },
      merchant_reference: expect.any(String),
    })
    expect(body).not.toHaveProperty('customer_name')
    expect(body).not.toHaveProperty('customer_email')
    expect(body).not.toHaveProperty('webhook_url')
  })

  it('returns a useful message when the provider rejects the request', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'setlo_test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 'parameter_invalid', message: 'Invalid phone number' }),
      }),
    )

    const result = await createSettloOrder({
      phone: '+255712345678',
      amountMinor: 5000,
      currency: 'TZS',
      description: 'test',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('That mobile number, amount or payment method was not accepted. Check the number and try again.')
  })

  it('does not call the API with a non-payment reference', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'setlo_test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await getSettloPayment('PAY123')

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retrieves a payment by its pi_ id', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'setlo_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pi_pay3', state: 'SUCCEEDED', amount: { value: 7000, currency: 'TZS' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getSettloPayment('pi_pay3')

    expect(result).toMatchObject({ success: true, orderId: 'pi_pay3', status: 'SUCCEEDED', amount: 7000 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.settlopay.co.tz/v1/payments/pi_pay3',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('verifies signed webhooks and re-reads the payment', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'setlo_test')
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pi_pay2', state: 'SUCCEEDED', amount: { value: 5000, currency: 'TZS' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({
      id: 'evt-2',
      type: 'payment_intent.succeeded',
      data: { id: 'pi_pay2', amount: 5000, currency: 'TZS' },
    })

    const event = await verifySettloWebhook(rawBody, sign(rawBody), 'evt-2')

    expect(event).toMatchObject({
      provider: 'settlopay',
      providerEventId: 'evt-2',
      orderId: 'pi_pay2',
      status: 'SUCCEEDED',
      amountMinor: 5000,
      verified: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects webhooks with bad signatures', async () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    await expect(verifySettloWebhook('payload', 't=1,v1=bad')).resolves.toBeNull()
  })
})
