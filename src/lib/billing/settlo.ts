import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const SETTLO_PROVIDER_NAME = 'settlopay'
export const SETTLO_API_VERSION = '2026-04-29'

const DEFAULT_BASE_URL = 'https://api.settlopay.co.tz'
const SIGNATURE_TOLERANCE_SECONDS = 300

type JsonRecord = Record<string, unknown>

export interface SettloPaymentInput {
  phone: string
  amountMinor: number
  currency: string
  description: string
  customerName?: string | null
  customerEmail?: string | null
  merchantReference?: string
  returnUrl?: string | null
  cancelUrl?: string | null
}

export interface SettloPaymentResult {
  success: boolean
  orderId: string | null
  status: string | null
  amountMinor: number | null
  currency: string | null
  netAmountMinor: number | null
  feeMinor: number | null
  merchantReference: string | null
  failureCode: string | null
  error: string | null
}

export interface SettloWebhookEvent {
  provider: typeof SETTLO_PROVIDER_NAME
  eventId: string | null
  providerEventId: string
  type: string
  status: string | null
  orderId: string | null
  amountMinor: number | null
  currency: string | null
  merchantReference: string | null
  failureCode: string | null
  verified: boolean
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'string' && field.trim() ? field.trim() : null
}

function numberField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'number' && Number.isFinite(field) ? field : null
}

function apiKey(): string {
  return process.env.SETTLO_API_KEY?.trim() ?? ''
}

function baseUrl(): string {
  return (process.env.SETTLO_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function apiVersion(): string {
  return process.env.SETTLO_API_VERSION?.trim() || SETTLO_API_VERSION
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

export function toE164TzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length === 12) return `+${digits}`
  return phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`
}

function amountValue(amountMinor: number): number {
  const amount = Math.round(amountMinor)
  return Number.isFinite(amount) ? Math.max(1, amount) : 1
}

function requestHeaders(includeIdempotencyKey: boolean, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
    'Settlo-Version': apiVersion(),
  }
  if (includeIdempotencyKey && idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return headers
}

function providerError(context: string, status: number, payload: JsonRecord | null): string {
  const code = stringField(payload, 'code')?.toUpperCase() ?? ''
  const message = stringField(payload, 'message')
  const param = stringField(payload, 'param')
  const requestId = stringField(payload, 'request_id')

  console.error('[settlopay] request failed', { context, status, code, param, message, requestId })

  if (param === 'method_data.phone' || param === 'phone' || code === 'UNSUPPORTED_PHONE_NETWORK') {
    return 'That mobile number was not accepted. Check the number and try again.'
  }
  if (param === 'amount.value' || param === 'amount' || code === 'UNSUPPORTED_CURRENCY') {
    return 'That amount is outside the allowed range. Try a different amount.'
  }
  if (status === 401 || status === 403 || code === 'AUTHENTICATION_REQUIRED' || code === 'PERMISSION_DENIED' || code === 'MERCHANT_NOT_TRANSACTABLE') {
    return 'Mobile-money payments are temporarily unavailable. Please contact support.'
  }
  if (code === 'PAYMENT_FAILED' || code === 'INSUFFICIENT_FUNDS' || code === 'ACCOUNT_NOT_PAYABLE') {
    return 'The payment was declined. Check your mobile-money balance and try again.'
  }
  if (code === 'IDEMPOTENCY_CONFLICT') {
    return 'This payment was already started. Check your payment status before trying again.'
  }
  if (status === 429 || code === 'RATE_LIMIT_EXCEEDED' || code === 'CONFIRMATION_THROTTLED' || code === 'TOO_MANY_ATTEMPTS') {
    return 'Too many payment requests right now. Please wait a minute and try again.'
  }
  if (status >= 500) {
    return 'Mobile-money payments are unavailable right now. Please try again shortly.'
  }
  if (message) return message
  return 'The payment could not be started. Please try again.'
}

function paymentResult(payload: JsonRecord | null, orderId: string | null, fallbackStatus?: string | null): SettloPaymentResult {
  if (!payload) {
    return {
      success: false,
      orderId,
      status: null,
      amountMinor: null,
      currency: null,
      netAmountMinor: null,
      feeMinor: null,
      merchantReference: null,
      failureCode: null,
      error: 'The payment provider returned an empty response.',
    }
  }

  const amount = isRecord(payload.amount) ? payload.amount : null
  return {
    success: true,
    orderId: stringField(payload, 'id') ?? orderId,
    status: stringField(payload, 'state') ?? fallbackStatus ?? null,
    amountMinor: numberField(amount, 'value'),
    currency: stringField(amount, 'currency'),
    netAmountMinor: numberField(payload, 'net'),
    feeMinor: numberField(payload, 'fee'),
    merchantReference: stringField(payload, 'merchant_reference'),
    failureCode: stringField(payload, 'failure_code'),
    error: null,
  }
}

export async function createSettloPayment(input: SettloPaymentInput): Promise<SettloPaymentResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId: null,
      status: null,
      amountMinor: null,
      currency: null,
      netAmountMinor: null,
      feeMinor: null,
      merchantReference: null,
      failureCode: null,
      error: 'SettloPay API key is not configured.',
    }
  }

  const merchantReference = input.merchantReference ?? `spotibet_${randomUUID()}`
  const metadata: JsonRecord = {}
  if (input.customerName?.trim()) metadata.customer_name = input.customerName.trim()
  if (input.customerEmail?.trim()) metadata.customer_email = input.customerEmail.trim()

  const body: JsonRecord = {
    amount: { value: amountValue(input.amountMinor), currency: input.currency },
    method: 'mobile_money',
    method_data: { phone: toE164TzPhone(input.phone) },
    merchant_reference: merchantReference,
    description: input.description,
    statement_descriptor: 'SPOTIBET',
  }
  if (Object.keys(metadata).length > 0) body.metadata = metadata
  if (input.returnUrl?.trim()) body.return_url = input.returnUrl.trim()
  if (input.cancelUrl?.trim()) body.cancel_url = input.cancelUrl.trim()

  try {
    const response = await fetch(`${baseUrl()}/v1/payments`, {
      method: 'POST',
      headers: requestHeaders(true, merchantReference),
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as JsonRecord | null
    if (!response.ok || !payload || !stringField(payload, 'id')) {
      return {
        ...paymentResult(null, null),
        error: providerError('create-payment', response.status, payload),
      }
    }
    return paymentResult(payload, stringField(payload, 'id'))
  } catch {
    return {
      ...paymentResult(null, null),
      error: 'Unable to reach the SettloPay API.',
    }
  }
}

export async function getSettloPayment(orderId: string): Promise<SettloPaymentResult> {
  const key = apiKey()
  if (!key) {
    return {
      success: false,
      orderId,
      status: null,
      amountMinor: null,
      currency: null,
      netAmountMinor: null,
      feeMinor: null,
      merchantReference: null,
      failureCode: null,
      error: 'SettloPay API key is not configured.',
    }
  }

  try {
    const response = await fetch(`${baseUrl()}/v1/payments/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: requestHeaders(false),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as JsonRecord | null
    if (!response.ok || !payload) {
      return {
        ...paymentResult(null, orderId),
        error: providerError('get-payment', response.status, payload),
      }
    }
    return paymentResult(payload, orderId)
  } catch {
    return {
      ...paymentResult(null, orderId),
      error: 'Unable to reach the SettloPay API.',
    }
  }
}

export async function confirmSettloPayment(orderId: string): Promise<SettloPaymentResult> {
  return getSettloPayment(orderId)
}

export function verifySettloWebhookSignature(rawBody: string, signature: string | null | undefined): boolean {
  const received = signature?.trim() ?? ''
  if (!received) return false

  const parts: Record<string, string> = {}
  for (const part of received.split(',')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key) parts[key] = value
  }

  const timestamp = Number(parts.t)
  const provided = parts.v1
  if (!Number.isFinite(timestamp) || !provided) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false

  const secret = webhookSecret()
  if (!secret) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function verifySettloWebhook(
  rawBody: string,
  signature: string | null | undefined,
  eventIdHeader?: string | null,
): Promise<SettloWebhookEvent | null> {
  if (!verifySettloWebhookSignature(rawBody, signature)) return null

  try {
    const envelope = JSON.parse(rawBody) as unknown
    if (!isRecord(envelope)) return null
    const data = isRecord(envelope.data) ? envelope.data : null
    if (!data) return null

    const orderId = stringField(data, 'id') ?? stringField(data, 'payment_id')
    if (!orderId) return null

    const eventAmount = numberField(data, 'amount')
    const eventCurrency = stringField(data, 'currency')
    const eventMerchantReference = stringField(data, 'merchant_reference')
    const confirmed = await getSettloPayment(orderId)
    if (!confirmed.success || !confirmed.orderId || !confirmed.status) return null
    if (eventAmount !== null && confirmed.amountMinor !== null && Math.abs(eventAmount - confirmed.amountMinor) > 0.01) return null
    if (eventCurrency && confirmed.currency && eventCurrency !== confirmed.currency) return null
    if (eventMerchantReference && confirmed.merchantReference && eventMerchantReference !== confirmed.merchantReference) return null

    return {
      provider: SETTLO_PROVIDER_NAME,
      eventId: eventIdHeader?.trim() || stringField(envelope, 'id'),
      providerEventId: confirmed.orderId,
      type: stringField(envelope, 'type') ?? 'payment.unknown',
      status: confirmed.status,
      orderId: confirmed.orderId,
      amountMinor: confirmed.amountMinor,
      currency: confirmed.currency,
      merchantReference: confirmed.merchantReference,
      failureCode: stringField(data, 'failure_code') ?? confirmed.failureCode,
      verified: true,
    }
  } catch {
    return null
  }
}
