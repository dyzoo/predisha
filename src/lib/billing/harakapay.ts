import { createHmac, timingSafeEqual } from 'node:crypto'

export const HARAKAPAY_PROVIDER_NAME = 'harakapay'
const DEFAULT_BASE_URL = 'https://harakapay.net'
const DEFAULT_USD_TO_TZS_RATE = 2600
const MIN_TZS_AMOUNT = 100

export interface HarakaPayOrderInput {
  phone: string
  amountMinor: number
  currency: string
  description: string
  webhookUrl: string | null
}

export interface HarakaPayOrderResult {
  success: boolean
  orderId: string | null
  status: string | null
  amount: number | null
  netAmount: number | null
  fee: number | null
  error: string | null
}

export interface HarakaPayWebhookEvent {
  provider: typeof HARAKAPAY_PROVIDER_NAME
  providerEventId: string
  type: string
  status: string | null
  orderId: string | null
  amountMinor: number | null
  currency: string | null
  verified: boolean
}

function apiKey(): string {
  return process.env.HARAKAPAY_API_KEY?.trim() ?? ''
}

function baseUrl(): string {
  const value = process.env.HARAKAPAY_BASE_URL?.trim() ?? DEFAULT_BASE_URL
  return value.replace(/\/+$/, '')
}

function webhookSecret(): string {
  return process.env.HARAKAPAY_WEBHOOK_SECRET?.trim() || process.env.BILLING_WEBHOOK_SECRET?.trim() || ''
}

function usdToTzsRate(): number {
  const parsed = Number.parseFloat(process.env.HARAKAPAY_USD_TO_TZS_RATE ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_TZS_RATE
}

export function harakapayApiKeyConfigured(): boolean {
  return apiKey().length > 0
}

export function harakapayWebhookSecretConfigured(): boolean {
  return webhookSecret().length > 0
}

export function toTzsAmount(amountMinor: number, rateTzsPerUsd: number): number {
  const tzs = Math.ceil((amountMinor / 100) * rateTzsPerUsd)
  return Math.max(tzs, MIN_TZS_AMOUNT)
}

export async function createHarakaPayOrder(input: HarakaPayOrderInput): Promise<HarakaPayOrderResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId: null,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'HarakaPay API key is not configured.',
    }
  }

  try {
    const response = await fetch(`${baseUrl()}/api/v1/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        phone: input.phone,
        amount: toTzsAmount(input.amountMinor, usdToTzsRate()),
        description: input.description,
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const error =
      payload && typeof payload.error === 'string'
        ? payload.error
        : payload && response.ok
          ? null
          : `HarakaPay checkout failed with status ${response.status}.`
    if (!response.ok || !payload || payload.success !== true) {
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
      orderId: typeof payload.order_id === 'string' ? payload.order_id : null,
      status: 'pending',
      amount: typeof payload.amount === 'number' ? payload.amount : null,
      netAmount: typeof payload.net_amount === 'number' ? payload.net_amount : null,
      fee: typeof payload.fee === 'number' ? payload.fee : null,
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
      error: 'Unable to reach the HarakaPay API.',
    }
  }
}

export async function getHarakaPayOrderStatus(orderId: string): Promise<HarakaPayOrderResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'HarakaPay API key is not configured.',
    }
  }

  try {
    const response = await fetch(`${baseUrl()}/api/v1/status/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: { 'X-API-Key': key },
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const payment =
      payload && typeof payload.payment === 'object' && payload.payment !== null
        ? (payload.payment as Record<string, unknown>)
        : null
    const status = payment && typeof payment.status === 'string' ? payment.status : null
    const amount = payment && typeof payment.amount === 'number' ? payment.amount : null
    const netAmount = payment && typeof payment.net_amount === 'number' ? payment.net_amount : null
    const feeAmount = payment && typeof payment.fee_amount === 'number' ? payment.fee_amount : null
    return {
      success: Boolean(payload && payload.success),
      orderId,
      status,
      amount,
      netAmount,
      fee: feeAmount,
      error: response.ok || payload?.success === true ? null : 'Unable to load the HarakaPay payment status.',
    }
  } catch {
    return {
      success: false,
      orderId,
      status: null,
      amount: null,
      netAmount: null,
      fee: null,
      error: 'Unable to reach the HarakaPay API.',
    }
  }
}

export function verifyHarakaPayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  const received = (signature?.trim().toLowerCase() ?? '').replace(/^sha256=/, '')
  if (!received) return false
  const secret = webhookSecret()
  if (!secret) return true

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

function buildWebhookEvent(
  orderId: string,
  status: string | null,
  amountMinor: number | null,
): HarakaPayWebhookEvent {
  return {
    provider: HARAKAPAY_PROVIDER_NAME,
    providerEventId: orderId,
    type: status ? `payment.${status}` : 'payment.unknown',
    status,
    orderId,
    amountMinor,
    currency: 'TZS',
    verified: true,
  }
}

export async function verifyHarakaPayWebhook(
  rawBody: string,
  signature: string | null | undefined,
): Promise<HarakaPayWebhookEvent | null> {
  let payload: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawBody) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    payload = parsed as Record<string, unknown>
  } catch {
    return null
  }

  const orderId = typeof payload.order_id === 'string' ? payload.order_id : null
  if (!orderId) return null

  const claimedStatus = typeof payload.status === 'string' ? payload.status : null
  const claimedAmount = typeof payload.amount === 'number' ? payload.amount : null

  const signed = Boolean(signature?.trim()) && Boolean(webhookSecret())
  if (signed) {
    if (!verifyHarakaPayWebhookSignature(rawBody, signature)) return null
    return buildWebhookEvent(orderId, claimedStatus, claimedAmount)
  }

  // HarakaPay does not sign its callbacks, so confirm the claimed status with
  // the status API before trusting an unsigned webhook.
  return confirmHarakaPayOrder(orderId)
}

export async function confirmHarakaPayOrder(
  orderId: string,
): Promise<HarakaPayWebhookEvent | null> {
  const status = await getHarakaPayOrderStatus(orderId)
  if (!status.success) return null
  return buildWebhookEvent(orderId, status.status, status.amount)
}
