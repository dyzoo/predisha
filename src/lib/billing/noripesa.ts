import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const NORIPESA_PROVIDER_NAME = 'noripesa'
const DEFAULT_BASE_URL = 'https://noripesa.com/api/v1'
const MIN_TZS_AMOUNT = 100
const MAX_TZS_AMOUNT = 50_000_000

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

function providerError(context: string, status: number, payload: Record<string, unknown> | null): string {
  const code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : ''
  const raw =
    typeof payload?.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : null

  console.error('[noripesa] request failed', { context, status, code, message: raw })

  if (status >= 200 && status < 300 && payload?.status === 'success') {
    return 'The payment provider did not return a payment reference. Please try again.'
  }

  const supportMessage = 'Mobile-money payments are temporarily unavailable. Please contact support.'
  if (
    status === 401 ||
    status === 403 ||
    code === 'INVALID_API_KEY' ||
    code === 'UNAUTHORIZED' ||
    code === 'MERCHANT_NOT_APPROVED' ||
    code === 'ACCOUNT_SUSPENDED' ||
    (raw !== null && /api key|unauthorized|invalid api/i.test(raw))
  ) {
    return supportMessage
  }

  if (code === 'INVALID_PHONE') {
    return 'That mobile number was not accepted. Check the number and try again.'
  }
  if (code === 'AMOUNT_TOO_LARGE') {
    return 'That amount is above the allowed limit. Try a smaller deposit.'
  }
  if (code === 'TOO_MANY_UNPAID_REQUESTS') {
    return 'This number has too many pending payment requests. Wait a few minutes, then try again.'
  }
  if (code === 'RATE_LIMITED') {
    return 'Too many payment requests right now. Please wait a minute and try again.'
  }
  if (code === 'PAYMENTS_PAUSED' || code === 'PROVIDER_UNAVAILABLE') {
    return 'Mobile-money payments are unavailable right now. Please try again shortly.'
  }
  if (code === 'PROVIDER_OUTCOME_UNKNOWN') {
    return 'We could not confirm the payment yet. Check your payment status before trying again.'
  }
  if (code === 'INVALID_REQUEST' || code === 'IDEMPOTENCY_KEY_REQUIRED') {
    return 'The payment request could not be started. Check your details and try again.'
  }
  if (raw !== null && !/checkout failed|status \d+/i.test(raw)) {
    return raw
  }
  if (status === 400) {
    return 'The payment request was rejected. Check your mobile number and amount, then try again.'
  }
  if (status === 429) {
    return 'Too many payment requests. Please wait a minute and try again.'
  }
  if (status >= 500) {
    return 'Mobile-money payments are unavailable right now. Please try again shortly.'
  }
  return 'The payment could not be started. Please try again.'
}

export function amountTzsFor(input: { amountMinor: number; currency: string }): number {
  const amount = Math.round(input.amountMinor)
  if (!Number.isFinite(amount)) return MIN_TZS_AMOUNT
  return Math.min(Math.max(amount, MIN_TZS_AMOUNT), MAX_TZS_AMOUNT)
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
      }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const data = payload && typeof payload === 'object' && typeof (payload as { data?: unknown }).data === 'object'
      ? (payload as { data: Record<string, unknown> }).data
      : null
    const status = data && typeof data.status === 'string' ? data.status : null
    const orderId = data && typeof data.reference === 'string' && data.reference.trim() ? data.reference : null
    if (!response.ok || payload?.status !== 'success' || !orderId) {
      return {
        success: false,
        orderId: null,
        status: null,
        amount: null,
        netAmount: null,
        fee: null,
        error: providerError('collect', response.status, payload),
      }
    }

    return {
      success: true,
      orderId,
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
    if (!response.ok || !status) {
      return {
        success: false,
        orderId,
        status: null,
        amount: null,
        netAmount: null,
        fee: null,
        error: providerError('status', response.status, payload),
      }
    }
    return {
      success: true,
      orderId,
      status,
      amount: payment && typeof payment.amount === 'number' ? payment.amount : null,
      netAmount: payment && typeof payment.net_amount === 'number' ? payment.net_amount : null,
      fee: payment && typeof payment.fee === 'number' ? payment.fee : null,
      error: null,
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
