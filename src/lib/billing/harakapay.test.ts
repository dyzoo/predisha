import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  confirmHarakaPayOrder,
  createHarakaPayOrder,
  getHarakaPayOrderStatus,
  toTzsAmount,
  verifyHarakaPayWebhook,
  verifyHarakaPayWebhookSignature,
} from './harakapay'

describe('harakapay helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('converts plan minor units to TZS amounts using the configured rate', () => {
    expect(toTzsAmount(499, 2600)).toBe(12974)
    expect(toTzsAmount(1499, 2600)).toBe(38974)
  })

  it('enforces the minimum TZS amount', () => {
    expect(toTzsAmount(0, 2600)).toBe(100)
  })

  it('verifies webhook signatures when a secret is configured', () => {
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ order_id: 'HP1706123456789', status: 'completed' })
    const signature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex')

    expect(verifyHarakaPayWebhookSignature(rawBody, signature)).toBe(true)
    expect(verifyHarakaPayWebhookSignature(rawBody, signature.toUpperCase())).toBe(true)
    expect(verifyHarakaPayWebhookSignature(rawBody, `sha256=${signature}`)).toBe(true)
    expect(verifyHarakaPayWebhookSignature(rawBody, 'deadbeef')).toBe(false)
    expect(verifyHarakaPayWebhookSignature(rawBody, null)).toBe(false)
  })

  it('accepts unsigned webhook bodies when no secret is configured', () => {
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', '')
    expect(verifyHarakaPayWebhookSignature('payload', null)).toBe(false)
    expect(verifyHarakaPayWebhookSignature('payload', 'abc')).toBe(true)
  })

  it('trusts a correctly signed webhook without calling the status API', async () => {
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', 'whsec_test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({ order_id: 'HP1', status: 'completed', amount: 10000 })
    const signature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex')

    const event = await verifyHarakaPayWebhook(rawBody, signature)

    expect(event).toMatchObject({ orderId: 'HP1', status: 'completed', amountMinor: 10000 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a signed webhook with a bad signature', async () => {
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ order_id: 'HP1', status: 'completed' })

    await expect(verifyHarakaPayWebhook(rawBody, 'deadbeef')).resolves.toBeNull()
  })

  it('confirms unsigned webhooks through the status API even when a secret is configured', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'hpk_test')
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', 'whsec_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, payment: { status: 'completed', amount: 5000 } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({ order_id: 'HP2', status: 'completed' })

    const event = await verifyHarakaPayWebhook(rawBody, null)

    expect(event).toMatchObject({ orderId: 'HP2', status: 'completed', amountMinor: 5000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('exposes the authoritative order status for manual confirmation', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'hpk_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, payment: { status: 'failed', amount: 7000 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const event = await confirmHarakaPayOrder('HP3')

    expect(event).toMatchObject({ orderId: 'HP3', status: 'failed', amountMinor: 7000 })
  })

  it('confirms unsigned webhooks through the status API', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'hpk_test')
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', '')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, payment: { status: 'completed', amount: 10000 } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({ order_id: 'HP1', status: 'pending' })

    const event = await verifyHarakaPayWebhook(rawBody, null)

    expect(event).toMatchObject({ orderId: 'HP1', status: 'completed', amountMinor: 10000 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://harakapay.net/api/v1/status/HP1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects unsigned webhooks when the status API does not confirm them', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'hpk_test')
    vi.stubEnv('HARAKAPAY_WEBHOOK_SECRET', '')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({ order_id: 'HP1', status: 'completed' })

    await expect(verifyHarakaPayWebhook(rawBody, null)).resolves.toBeNull()
  })

  it('prefixes a bare key with hpk_ before calling the provider', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'bare_key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, order_id: 'HP1', amount: 10000 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createHarakaPayOrder({
      phone: '0712345678',
      amountMinor: 10000,
      currency: 'TZS',
      description: 'test',
      webhookUrl: null,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://harakapay.net/api/v1/collect',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'hpk_bare_key' }),
      }),
    )
  })

  it('hides the raw invalid-key error from deposit users but logs it for operators', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'bad_key')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: 'Invalid API key' }),
      }),
    )

    const order = await createHarakaPayOrder({
      phone: '0712345678',
      amountMinor: 10000,
      currency: 'TZS',
      description: 'test',
      webhookUrl: null,
    })

    expect(order.success).toBe(false)
    expect(order.error).toBe('Mobile-money payments are temporarily unavailable. Please contact support.')
    expect(order.error).not.toContain('Invalid API key')
    expect(log).toHaveBeenCalledWith(
      '[harakapay] provider rejected the API key',
      expect.objectContaining({ context: 'collect', status: 401, error: 'Invalid API key' }),
    )
  })

  it('hides the raw invalid-key error from deposit status polling', async () => {
    vi.stubEnv('HARAKAPAY_API_KEY', 'bad_key')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: 'Invalid API key' }),
      }),
    )

    const result = await getHarakaPayOrderStatus('HP1')

    expect(result.error).toBe('Mobile-money payments are temporarily unavailable. Please contact support.')
    expect(result.error).not.toContain('Invalid API key')
  })
})
