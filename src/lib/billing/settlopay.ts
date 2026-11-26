import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const SETTLO_PROVIDER_NAME = 'settlopay'

const DEFAULT_BASE_URL = 'https://api.settlopay.co.tz/v1'
const API_VERSION = '2026-04-29'
const REQUEST_TIMEOUT_MS = 8_000
const MIN_TZS_AMOUNT = 100
const MAX_TZS_AMOUNT = 50_000_000
const MAX_WEBHOOK_AGE_SECONDS = 300

const PAID_STATES = new Set(['SUCCEEDED', 'CHARGEBACK_WON', 'PARTIALLY_REFUNDED'])
const FAILED_STATES = new Set([
  'BLOCKED',
  'FAILED',
  'CHARGEBACK_LOST',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
])

export interface SettloOrderInput {
  phone: string
  amountMinor: number
  currency: string
  description: string
  merchantReference?: string
}

export interface SettloOrderResult {
  success: boolean
  orderId: string | null
  status: string | null
  amount: number | null
  error: string | null
}

export interface SettloWebhookEvent {
  provider: typeof SETTLO_PROVIDER_NAME
  providerEventId: string
  type: string
  status: string | null
  orderId: string | null
  amountMinor: number | null
  currency: string | null
  verified: boolean
}

export type SettloOutcome = 'PAID' | 'PENDING' | 'FAILED'

class SettloRequestError extends Error {
  code: string
  status: number

  constructor(status: number, payload: Record<string, unknown> | null) {
    super(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : `Settlo Pay request failed (${status})`,
    )
    this.code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : ''
    this.status = status
  }
}

function apiKey(): string {
  return process.env.SETTLO_API_KEY?.trim() ?? ''
}

function baseUrl(): string {
  return (process.env.SETTLO_BASE_URL?.trim() ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function webhookSecret(): string {
  return process.env.SETTLO_WEBHOOK_SECRET?.trim() ?? ''
}

export function settloApiKeyConfigured(): boolean {
  return apiKey().length > 0
}

export function settloWebhookSecretConfigured(): boolean {
  return webhookSecret().length > 0
}

export function mapSettloState(state: string | null | undefined): SettloOutcome {
  const normalized = (state ?? '').trim().toUpperCase()
  if (PAID_STATES.has(normalized)) return 'PAID'
  if (FAILED_STATES.has(normalized)) return 'FAILED'
  return 'PENDING'
}

export function amountTzsFor(input: { amountMinor: number; currency: string }): number {
  const amount = Math.round(input.amountMinor)
  if (!Number.isFinite(amount)) return MIN_TZS_AMOUNT
  return Math.min(Math.max(amount, MIN_TZS_AMOUNT), MAX_TZS_AMOUNT)
}

function providerError(context: string, error: unknown): string {
  const failure = error instanceof SettloRequestError ? error : null
  const code = failure?.code ?? ''
  const status = failure?.status ?? 0
  const raw = error instanceof Error ? error.message : ''
  console.error('[settlopay] request failed', { context, status, code, message: raw })

  const supportMessage = 'Mobile-money payments are temporarily unavailable. Please contact support.'
  if (
    status === 401 ||
    status === 403 ||
    ['AUTHENTICATION_REQUIRED', 'MERCHANT_NOT_TRANSACTABLE'].includes(code)
  ) {
    return supportMessage
  }
  if (['PARAMETER_INVALID', 'UNSUPPORTED_METHOD', 'UNSUPPORTED_PHONE_NETWORK'].includes(code)) {
    return 'That mobile number, amount or payment method was not accepted. Check the number and try again.'
  }
  if (['PAYMENT_FAILED', 'PROVIDER_OUTCOME_UNKNOWN'].includes(code)) {
    return 'We could not confirm the payment yet. Check your payment status before trying again.'
  }
  if (['IDEMPOTENCY_CONFLICT', 'INVALID_REQUEST'].includes(code)) {
    return 'The payment request could not be started. Check your details and try again.'
  }
  if (code === 'RATE_LIMIT_EXCEEDED' || status === 429) {
    return 'Too many payment requests right now. Please wait a minute and try again.'
  }
  if (status === 400) {
    return 'The payment request was rejected. Check your mobile number and amount, then try again.'
  }
  if (status >= 500 || ['TRY_LATER', 'SERVICE_UNAVAILABLE'].includes(code)) {
    return 'Mobile-money payments are unavailable right now. Please try again shortly.'
  }
  if (raw && !/checkout failed|status \d+/i.test(raw)) return raw
  return 'The payment could not be started. Please try again.'
}

async function request(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<Record<string, unknown> | null> {
  const key = apiKey()
  if (!key) throw new Error('SETTLO_API_KEY is not configured.')
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Settlo-Version': API_VERSION,
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) throw new SettloRequestError(response.status, payload)
  return payload && typeof payload === 'object' ? payload : null
}

function paymentAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object') {
    const inner = (value as { value?: unknown }).value
    if (typeof inner === 'number' && Number.isFinite(inner)) return inner
  }
  return null
}

function isPaymentId(value: unknown): value is string {
  return typeof value === 'string' && /^pi_[A-Za-z0-9_-]+$/.test(value)
}

function resultFromPayment(
  payment: Record<string, unknown> | null,
  fallbackId: string | null,
): SettloOrderResult {
  const orderId = isPaymentId(payment?.id) ? payment.id : fallbackId
  if (!orderId) {
    return { success: false, orderId: null, status: null, amount: null, error: providerError('payment', new Error('No payment id returned')) }
  }
  return {
    success: true,
    orderId,
    status: typeof payment?.state === 'string' ? payment.state : null,
    amount: paymentAmount(payment?.amount),
    error: null,
  }
}

export async function createSettloOrder(input: SettloOrderInput): Promise<SettloOrderResult> {
  if (!settloApiKeyConfigured()) {
    return { success: false, orderId: null, status: null, amount: null, error: 'SETTLO_API_KEY is not configured.' }
  }

  const merchantReference = input.merchantReference ?? `FWZ-${randomUUID()}`
  try {
    const payment = await request('/payments', {
      method: 'POST',
      idempotencyKey: merchantReference,
      body: {
        amount: { value: amountTzsFor(input), currency: 'TZS' },
        method: 'mobile_money',
        method_data: { phone: input.phone },
        merchant_reference: merchantReference,
        description: input.description,
      },
    })
    return resultFromPayment(payment, null)
  } catch (error) {
    return { success: false, orderId: null, status: null, amount: null, error: providerError('create', error) }
  }
}

export async function getSettloPayment(orderId: string): Promise<SettloOrderResult> {
  if (!isPaymentId(orderId)) {
    return { success: false, orderId: null, status: null, amount: null, error: 'Invalid payment reference.' }
  }
  if (!settloApiKeyConfigured()) {
    return { success: false, orderId, status: null, amount: null, error: 'SETTLO_API_KEY is not configured.' }
  }

  try {
    const payment = await request(`/payments/${encodeURIComponent(orderId)}`)
    return resultFromPayment(payment, orderId)
  } catch (error) {
    return { success: false, orderId, status: null, amount: null, error: providerError('retrieve', error) }
  }
}

export async function confirmSettloPayment(orderId: string): Promise<SettloOrderResult> {
  return getSettloPayment(orderId)
}

function webhookAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  if (value && typeof value === 'object') {
    const inner = (value as { value?: unknown }).value
    if (typeof inner === 'number' && Number.isFinite(inner)) return Math.round(inner)
    if (typeof inner === 'string' && inner.trim()) {
      const parsed = Number(inner)
      if (Number.isFinite(parsed)) return Math.round(parsed)
    }
  }
  return null
}

export function parseSettloWebhookEvent(
  rawBody: string,
  eventIdHeader?: string | null,
): SettloWebhookEvent | null {
  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown> | null
    if (!payload || typeof payload !== 'object') return null
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : {}
    const type = typeof payload.type === 'string' ? payload.type : 'payment.unknown'
    const baseEvent: Omit<
      SettloWebhookEvent,
      'status' | 'orderId' | 'amountMinor' | 'currency'
    > = {
      provider: SETTLO_PROVIDER_NAME,
      providerEventId: firstString(eventIdHeader, payload.id) ?? '',
      type,
      verified: true,
    }
    if (!type.startsWith('payment_intent.')) {
      return { ...baseEvent, status: null, orderId: null, amountMinor: null, currency: null }
    }
    const orderId = firstString(data.id, data.external_id, data.merchant_reference)
    if (!isPaymentId(orderId)) return null
    return {
      ...baseEvent,
      status: firstString(payload.status, data.status, data.state),
      orderId,
      amountMinor: webhookAmount(data.amount ?? payload.amount),
      currency: firstString(data.currency, payload.currency) ?? 'TZS',
    }
  } catch {
    return null
  }
}

export function verifySettloWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  const secret = webhookSecret()
  if (!secret || !signature) return false

  const parts = Object.fromEntries(
    signature.trim().split(',').map(part => {
      const separator = part.indexOf('=')
      return separator < 0
        ? [part.trim(), '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    }),
  )
  const timestamp = Number(parts.t)
  const provided = parts.v1
  if (!Number.isFinite(timestamp) || !provided) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_WEBHOOK_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest()
  const received = Buffer.from(provided, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export async function verifySettloWebhook(
  rawBody: string,
  signature: string | null | undefined,
  eventIdHeader?: string | null,
): Promise<SettloWebhookEvent | null> {
  if (!verifySettloWebhookSignature(rawBody, signature)) return null
  const event = parseSettloWebhookEvent(rawBody, eventIdHeader)
  if (!event) return null
  if (!event.type.startsWith('payment_intent.') || !event.orderId) return event

  const confirmed = await confirmSettloPayment(event.orderId)
  if (!confirmed.success || !confirmed.orderId) return null
  return {
    ...event,
    providerEventId: event.providerEventId || confirmed.orderId,
    status: confirmed.status,
    orderId: confirmed.orderId,
    amountMinor: confirmed.amount,
    currency: 'TZS',
  }
}
