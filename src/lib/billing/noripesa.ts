import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const NORIPESA_PROVIDER_NAME = 'noripesa'
const DEFAULT_BASE_URL = 'https://noripesa.com/api/v1'
const MIN_TZS_AMOUNT = 100

export interface NoripesaOrderInput {
  phone: string
  amountMinor: number
  currency: string
  description: string
  webhookUrl: string | null
  merchantReference?: string
  customerName?: string | null
  customerEmail?: string | null
}

export interface NoripesaOrderResult {
  success: boolean
  orderId: string | null
  status: string | null
  amount: number | null
  netAmount: number | null
  fee: number | null
  error: string | null
}

export interface NoripesaWebhookEvent {
  provider: typeof NORIPESA_PROVIDER_NAME
  providerEventId: string
  type: string
  status: string | null
  orderId: string | null
  amountMinor: number | null
  currency: string | null
  verified: boolean
}

function apiKey(): string {
  return process.env.NORIPESA_API_KEY?.trim() ?? ''
}

function baseUrl(): string {
  return (process.env.NORIPESA_BASE_URL?.trim() ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function webhookSecret(): string {
  return process.env.NORIPESA_WEBHOOK_SECRET?.trim() || process.env.BILLING_WEBHOOK_SECRET?.trim() || ''
}

export function noripesaApiKeyConfigured(): boolean {
  return apiKey().length > 0
}

export function noripesaWebhookSecretConfigured(): boolean {
  return webhookSecret().length > 0
}

function sanitizeProviderError(context: string, status: number, raw: string | null): string | null {
  if (status === 401 || status === 403 || (raw !== null && /api key|unauthorized|invalid api/i.test(raw))) {
    console.error('[noripesa] provider rejected the API key', { context, status, error: raw })
    return 'Mobile-money payments are temporarily unavailable. Please contact support.'
  }
  return raw
}

export function amountTzsFor(input: { amountMinor: number; currency: string }): number {
  const amount = Math.max(Math.round(input.amountMinor), MIN_TZS_AMOUNT)
  return amount
}

export async function createNoripesaOrder(input: NoripesaOrderInput): Promise<NoripesaOrderResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId: null,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'NORIPESA API key is not configured.',
    }
  }

  const merchantReference = input.merchantReference ?? `noripesa_${randomUUID()}`
  try {
    const response = await fetch(`${baseUrl()}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'Idempotency-Key': merchantReference,
      },
      body: JSON.stringify({
        amount: amountTzsFor(input),
        phone: input.phone,
        ...(input.customerName ? { customer_name: input.customerName } : {}),
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        merchant_reference: merchantReference,
        description: input.description,
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const data = payload && typeof payload === 'object' && typeof (payload as { data?: unknown }).data === 'object'
      ? (payload as { data: Record<string, unknown> }).data
      : null
    const status = data && typeof data.status === 'string' ? data.status : null
    const error =
      sanitizeProviderError('collect', response.status, typeof payload?.error === 'string' ? payload.error : null) ??
      (response.ok && payload?.status === 'success' ? null : `NORIPESA checkout failed with status ${response.status}.`)
    if (!response.ok || payload?.status !== 'success') {
      return {
        success: false,
        orderId: null,
        status: null,
        amount: null,
        netAmount: null,
        fee: null,
        error,
      }
    }

    return {
      success: true,
      orderId: data && typeof data.reference === 'string' ? data.reference : null,
      status,
      amount: data && typeof data.amount === 'number' ? data.amount : null,
      netAmount: data && typeof data.net_amount === 'number' ? data.net_amount : null,
      fee: data && typeof data.fee === 'number' ? data.fee : null,
      error: null,
    }
  } catch {
    return {
      success: false,
      orderId: null,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'Unable to reach the NORIPESA API.',
    }
  }
}

export async function getNoripesaOrderStatus(orderId: string): Promise<NoripesaOrderResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'NORIPESA API key is not configured.',
    }
  }

  try {
    const response = await fetch(`${baseUrl()}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ reference: orderId }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const data = payload && typeof payload === 'object' && typeof (payload as { data?: unknown }).data === 'object'
      ? (payload as { data: Record<string, unknown> }).data
      : null
    const payment = data ?? payload
    const status = payment && typeof payment.status === 'string' ? payment.status : null
    const error =
      sanitizeProviderError('status', response.status, typeof payload?.error === 'string' ? payload.error : null) ??
      (response.ok && status ? null : 'Unable to load the NORIPESA payment status.')
    return {
      success: response.ok && status !== null,
      orderId,
      status,
      amount: payment && typeof payment.amount === 'number' ? payment.amount : null,
      netAmount: payment && typeof payment.net_amount === 'number' ? payment.net_amount : null,
      fee: payment && typeof payment.fee === 'number' ? payment.fee : null,
      error,
    }
  } catch {
    return {
      success: false,
      orderId,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'Unable to reach the NORIPESA API.',
    }
  }
}

export function verifyNoripesaWebhookSignature(rawBody: string, signature: string | null | undefined): boolean {
  const received = signature?.trim() ?? ''
  const parts = Object.fromEntries(
    received.split(',').map(part => {
      const separator = part.indexOf('=')
      const key = separator === -1 ? part : part.slice(0, separator)
      const value = separator === -1 ? '' : part.slice(separator + 1)
      return [key, value]
    }),
  )
  const timestamp = Number(parts.t)
  const provided = parts.v1
  if (!Number.isFinite(timestamp) || !provided) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false
  const secret = webhookSecret()
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function verifyNoripesaWebhook(rawBody: string, signature: string | null | undefined): Promise<NoripesaWebhookEvent | null> {
  const verified = verifyNoripesaWebhookSignature(rawBody, signature)
  if (!verified) return null
  try {
    const payload = JSON.parse(rawBody) as { data?: { reference?: string; status?: string; amount?: number } }
    const orderId = payload?.data?.reference ?? null
    if (!orderId) return null
    const status = payload?.data?.status ?? null
    const confirmed = await confirmNoripesaOrder(orderId)
    if (!confirmed.success || !confirmed.orderId) return null
    return {
      provider: NORIPESA_PROVIDER_NAME,
      providerEventId: confirmed.orderId,
      type: status ? `payment.${status}` : 'payment.unknown',
      status: confirmed.status,
      orderId: confirmed.orderId,
      amountMinor: confirmed.amount,
      currency: 'TZS',
      verified: true,
    }
  } catch {
    return null
  }
}

export async function confirmNoripesaOrder(orderId: string): Promise<NoripesaOrderResult> {
  const status = await getNoripesaOrderStatus(orderId)
  if (!status.success) return status
  return { ...status, success: true }
}
