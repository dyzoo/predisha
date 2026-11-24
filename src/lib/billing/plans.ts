import { formatTzs } from '@/lib/bet/format'
import { prisma } from '@/lib/prisma'
import { isBillingEnabled } from './provider'

export type PlanInterval = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'

export interface PublicPlan {
  id: string
  name: string
  interval: PlanInterval
  amountMinor: number
  currency: string
  available: boolean
  features: string[]
  slipLimit: number
  durationDays: number
}

export interface PublicPlanResponse {
  billingEnabled: boolean
  provider: string
  notice: string
  plans: PublicPlan[]
}

export interface PlanDefinition {
  id: string
  name: string
  interval: PlanInterval
  amountMinor: number
  currency: string
  slipLimit: number
  durationDays: number
  features: string[]
}

export const PLAN_DEFAULTS: PlanDefinition[] = [
  {
    id: 'weekly',
    name: 'Weekly',
    interval: 'WEEKLY',
    amountMinor: 2000,
    currency: 'TZS',
    slipLimit: 5,
    durationDays: 7,
    features: [
      'Create 5 AI bet slips',
      'Full prediction board',
      'Saved matches and preferences',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    interval: 'MONTHLY',
    amountMinor: 5000,
    currency: 'TZS',
    slipLimit: 15,
    durationDays: 30,
    features: [
      'Create 15 AI bet slips',
      'Everything in Weekly',
      'Historical performance and evaluation detail',
    ],
  },
  {
    id: 'quarterly',
    name: '3 Months',
    interval: 'QUARTERLY',
    amountMinor: 12000,
    currency: 'TZS',
    slipLimit: 25,
    durationDays: 90,
    features: [
      'Create 25 AI bet slips',
      'Everything in Monthly',
      'Priority access to new validated markets',
    ],
  },
]

export const PLAN_IDS = PLAN_DEFAULTS.map(plan => plan.id)

export function planIntervalForDuration(days: number): PlanInterval {
  if (days <= 7) return 'WEEKLY'
  if (days <= 30) return 'MONTHLY'
  return 'QUARTERLY'
}

export function formatPlanAmount(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return 'Not published'
  if (currency.trim().toUpperCase() === 'TZS') return formatTzs(amountMinor)
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100)
  } catch {
    return `${amountMinor / 100} ${currency}`
  }
}

function normalizeFeatures(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const features = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )
  return features.length > 0 ? features : fallback
}

export async function getPublicPlans(): Promise<PublicPlanResponse> {
  const provider = process.env.BILLING_PROVIDER ?? 'disabled'
  const billingEnabled = isBillingEnabled()
  const rows = await prisma.subscriptionPlan
    .findMany({ where: { id: { in: [...PLAN_IDS] } } })
    .catch(() => [])
  const rowsById = new Map(rows.map(row => [row.id, row]))

  const plans: PublicPlan[] = PLAN_DEFAULTS.map(definition => {
    const row = rowsById.get(definition.id)
    const amountMinor = row?.amountMinor ?? definition.amountMinor
    const currency = row?.currency ?? definition.currency
    const durationDays = row?.durationDays ?? definition.durationDays
    return {
      id: definition.id,
      name: row?.name ?? definition.name,
      interval: planIntervalForDuration(durationDays),
      amountMinor,
      currency,
      available: billingEnabled && (row?.active ?? true) && amountMinor > 0,
      features: normalizeFeatures(row?.features, definition.features),
      slipLimit: row?.slipLimit ?? definition.slipLimit,
      durationDays,
    }
  })

  return {
    billingEnabled,
    provider,
    notice: billingEnabled
      ? provider.trim().toLowerCase() === 'manual'
        ? 'Test billing is enabled. Plan activation does not take a real payment.'
        : 'Billing is enabled. Checkout is processed by the approved payment provider.'
      : 'Subscriptions are not open yet. Live billing stays disabled until the payment provider approves the business model, entity and target markets.',
    plans,
  }
}
