import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  confirmSettloPayment,
  createSettloPayment,
  getSettloPayment,
  toE164TzPhone,
  verifySettloWebhook,
  verifySettloWebhookSignature,
} from './settlo'

function sign(rawBody: string, secret = 'whsec_test', t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex')
  return `t=${t},v1=${v1}`
}

describe('settlo helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes Tanzanian phone numbers to E.164', () => {
    expect(toE164TzPhone('255712345678')).toBe('+255712345678')
    expect(toE164TzPhone('+255712345678')).toBe('+255712345678')
  })

  it('verifies webhook signatures when a secret is configured', () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' })
    expect(verifySettloWebhookSignature(rawBody, sign(rawBody))).toBe(true)
    expect(verifySettloWebhookSignature(rawBody, 't=1,v1=deadbeef')).toBe(false)
  })

  it('rejects invalid or missing signatures', () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    expect(verifySettloWebhookSignature('payload', null)).toBe(false)
    expect(verifySettloWebhookSignature('payload', 'bad')).toBe(false)

    vi.stubEnv('SETTLO_WEBHOOK_SECRET', '')
    expect(verifySettloWebhookSignature('payload', sign('payload'))).toBe(false)
  })

  it('creates a mobile-money payment through the SettloPay API', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'sk_live_test')
    vi.stubEnv('SETTLO_BASE_URL', 'https://api.settlopay.co.tz')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'pi_1',
        object: 'payment_intent',
        state: 'PENDING_AUTH',
        amount: { value: 5000, currency: 'TZS' },
        merchant_reference: 'spotibet_1',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createSettloPayment({
      phone: '255712345678',
      amountMinor: 5000,
      currency: 'TZS',
      description: 'test',
      merchantReference: 'spotibet_1',
    })

    expect(result.success).toBe(true)
    expect(result.orderId).toBe('pi_1')
    expect(result.status).toBe('PENDING_AUTH')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.settlopay.co.tz/v1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_live_test',
          'Idempotency-Key': 'spotibet_1',
          'Settlo-Version': '2026-04-29',
        }),
      }),
    )
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({
      amount: { value: 5000, currency: 'TZS' },
      method: 'mobile_money',
      method_data: { phone: '+255712345678' },
      merchant_reference: 'spotibet_1',
    })
  })

  it('returns a useful message when the provider rejects the request', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'sk_live_test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          type: 'validation_error',
          code: 'unsupported_phone_network',
          message: 'Unsupported phone network',
          param: 'method_data.phone',
        }),
      }),
    )

    const result = await createSettloPayment({
      phone: '255712345678',
      amountMinor: 5000,
      currency: 'TZS',
      description: 'test',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('That mobile number was not accepted. Check the number and try again.')
  })

  it('gets a payment by id', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'sk_live_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pi_2',
        state: 'SUCCEEDED',
        amount: { value: 7000, currency: 'TZS' },
        merchant_reference: 'spotibet_2',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getSettloPayment('pi_2')
    expect(result.status).toBe('SUCCEEDED')
    expect(result.amountMinor).toBe(7000)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.settlopay.co.tz/v1/payments/pi_2',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('confirmSettloPayment returns the current payment state', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'sk_live_test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'pi_3',
          state: 'FAILED',
          amount: { value: 7000, currency: 'TZS' },
          failure_code: 'payment_failed',
        }),
      }),
    )

    const result = await confirmSettloPayment('pi_3')
    expect(result.status).toBe('FAILED')
    expect(result.failureCode).toBe('payment_failed')
  })

  it('verifies signed webhooks and confirms the current payment state', async () => {
    vi.stubEnv('SETTLO_API_KEY', 'sk_live_test')
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pi_4',
        state: 'SUCCEEDED',
        amount: { value: 5000, currency: 'TZS' },
        merchant_reference: 'spotibet_4',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({
      id: 'evt_4',
      type: 'payment_intent.succeeded',
      data: {
        id: 'pi_4',
        state: 'SUCCEEDED',
        amount: 5000,
        currency: 'TZS',
        merchant_reference: 'spotibet_4',
      },
    })

    const event = await verifySettloWebhook(rawBody, sign(rawBody), 'evt_4')
    expect(event).toMatchObject({
      provider: 'settlopay',
      eventId: 'evt_4',
      orderId: 'pi_4',
      status: 'SUCCEEDED',
      amountMinor: 5000,
      verified: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects webhooks with bad signatures', async () => {
    vi.stubEnv('SETTLO_WEBHOOK_SECRET', 'whsec_test')
    await expect(verifySettloWebhook('{}', 't=1,v1=bad')).resolves.toBeNull()
  })
})
