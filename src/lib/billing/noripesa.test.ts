import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  confirmNoripesaOrder,
  createNoripesaOrder,
  getNoripesaOrderStatus,
  verifyNoripesaWebhook,
  verifyNoripesaWebhookSignature,
} from './noripesa'

function sign(rawBody: string, secret = 'whsec_test', t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  return `t=${t},v1=${v1}`
}

describe('noripesa helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('verifies webhook signatures when a secret is configured', () => {
    vi.stubEnv('NORIPESA_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ data: { reference: 'ref-1', status: 'success' } })
    const sig = sign(rawBody)
    expect(verifyNoripesaWebhookSignature(rawBody, sig)).toBe(true)
    expect(verifyNoripesaWebhookSignature(rawBody, 't=1,v1=deadbeef')).toBe(false)
  })

  it('rejects invalid or missing signatures', () => {
    vi.stubEnv('NORIPESA_WEBHOOK_SECRET', 'whsec_test')
    expect(verifyNoripesaWebhookSignature('payload', null)).toBe(false)
    expect(verifyNoripesaWebhookSignature('payload', 'bad')).toBe(false)
  })

  it('creates an order through the collect endpoint', async () => {
    vi.stubEnv('NORIPESA_API_KEY', 'nori_test')
    vi.stubEnv('NORIPESA_BASE_URL', 'https://noripesa.com/api/v1')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ status: 'success', data: { reference: 'ref-1', status: 'pending', amount: 1000 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createNoripesaOrder({
      phone: '255712345678',
      amountMinor: 1000,
      currency: 'TZS',
      description: 'test',
      webhookUrl: null,
    })

    expect(result.success).toBe(true)
    expect(result.orderId).toBe('ref-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://noripesa.com/api/v1/collect',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer nori_test' }),
      }),
    )
  })

  it('gets order status through the status endpoint', async () => {
    vi.stubEnv('NORIPESA_API_KEY', 'nori_test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', data: { status: 'success', amount: 7000 } }),
      }),
    )

    const result = await getNoripesaOrderStatus('ref-3')
    expect(result.success).toBe(true)
    expect(result.status).toBe('success')
    expect(result.amount).toBe(7000)
  })

  it('confirmNoripesaOrder returns status result', async () => {
    vi.stubEnv('NORIPESA_API_KEY', 'nori_test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', data: { status: 'failed', amount: 7000 } }),
      }),
    )
    const result = await confirmNoripesaOrder('ref-4')
    expect(result.status).toBe('failed')
  })

  it('verifies signed webhooks and confirms via status API', async () => {
    vi.stubEnv('NORIPESA_API_KEY', 'nori_test')
    vi.stubEnv('NORIPESA_WEBHOOK_SECRET', 'whsec_test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { reference: 'ref-2', status: 'success', amount: 5000 } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const rawBody = JSON.stringify({ data: { reference: 'ref-2', status: 'success', amount: 5000 } })
    const sig = sign(rawBody)

    const event = await verifyNoripesaWebhook(rawBody, sig)
    expect(event).toMatchObject({ orderId: 'ref-2', status: 'success', amountMinor: 5000, verified: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects webhooks with bad signatures', async () => {
    vi.stubEnv('NORIPESA_WEBHOOK_SECRET', 'whsec_test')
    const rawBody = JSON.stringify({ data: { reference: 'ref-1', status: 'success' } })
    await expect(verifyNoripesaWebhook(rawBody, 't=1,v1=bad')).resolves.toBeNull()
  })
})
