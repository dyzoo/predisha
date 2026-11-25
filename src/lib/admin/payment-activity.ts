import { formatDateTimeLabel } from '@/lib/bet/format'
import { formatPlanAmount } from '@/lib/billing/plans'

export type PaymentActivityKind = 'DEPOSIT' | 'SHARED_SLIP' | 'SUBSCRIPTION'
export type PaymentActivityStatus = 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN'

export interface PaymentActivityInput {
  id: string
  kind: PaymentActivityKind
  client: string | null
  phone: string | null
  amountMinor: number | null
  currency: string
  provider: string | null
  reference: string | null
  status: string | null
  createdAt: Date | string
}

export interface PaymentActivityView {
  id: string
  kind: PaymentActivityKind
  kindLabel: string
  client: string
  phone: string
  amount: string
  currency: string
  provider: string
  reference: string
  status: PaymentActivityStatus
  createdAt: string
  createdAtLabel: string
}

const KIND_LABELS: Record<PaymentActivityKind, string> = {
  DEPOSIT: 'Wallet deposit',
  SHARED_SLIP: 'Shared slip',
  SUBSCRIPTION: 'Subscription',
}

const PAID_STATES = new Set([
  'PAID',
  'SUCCEEDED',
  'CHARGEBACK_WON',
  'PARTIALLY_REFUNDED',
])
const PENDING_STATES = new Set([
  'PENDING',
  'PENDING_AUTH',
  'PROCESSING',
  'INITIATED',
  'CREATED',
])
const FAILED_STATES = new Set([
  'FAILED',
  'CANCELLED',
  'CANCELED',
  'BLOCKED',
  'EXPIRED',
  'REFUNDED',
  'CHARGEBACK_LOST',
])

export function normalizePaymentStatus(
  status: string | null | undefined,
): PaymentActivityStatus {
  if (!status) return 'UNKNOWN'
  const normalized = status.trim().toUpperCase()
  if (PAID_STATES.has(normalized)) return 'PAID'
  if (PENDING_STATES.has(normalized)) return 'PENDING'
  if (FAILED_STATES.has(normalized)) return 'FAILED'
  return 'UNKNOWN'
}

export function readJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function readJsonString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function readJsonNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

function timestampOf(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

export function buildPaymentActivity(rows: PaymentActivityInput[]): PaymentActivityView[] {
  return [...rows]
    .sort((left, right) => timestampOf(right.createdAt) - timestampOf(left.createdAt))
    .map(row => {
      const createdAt =
        row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
      return {
        id: row.id,
        kind: row.kind,
        kindLabel: KIND_LABELS[row.kind],
        client: row.client?.trim() || 'Unknown client',
        phone: row.phone?.trim() || 'Not provided',
        amount: formatPlanAmount(row.amountMinor, row.currency),
        currency: row.currency,
        provider: row.provider?.trim() || 'unknown',
        reference: row.reference?.trim() || row.id,
        status: normalizePaymentStatus(row.status),
        createdAt,
        createdAtLabel: formatDateTimeLabel(createdAt),
      }
    })
}
