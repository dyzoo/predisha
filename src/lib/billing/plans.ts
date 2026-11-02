export type PlanInterval = 'WEEKLY' | 'MONTHLY'

export interface PublicPlan {
  id: string
  name: string
  interval: PlanInterval
  amountMinor: number | null
  currency: string
  available: boolean
  features: string[]
}

export interface PublicPlanResponse {
  billingEnabled: boolean
  provider: string
  notice: string
  plans: PublicPlan[]
}

function readAmount(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Prices are configuration, never hardcoded constants. When no approved
 * billing provider is configured the plans are returned as unavailable so the
 * UI can show an honest "coming soon" state.
 */
export function getPublicPlans(): PublicPlanResponse {
  const provider = process.env.BILLING_PROVIDER ?? 'disabled'
  const billingEnabled =
    process.env.BILLING_LIVE_ENABLED === 'true' && provider !== 'disabled'
  const currency = (process.env.BILLING_CURRENCY ?? 'USD').toUpperCase()

  const plans: PublicPlan[] = [
    {
      id: 'weekly',
      name: 'Weekly Premium',
      interval: 'WEEKLY',
      amountMinor: readAmount(process.env.BILLING_WEEKLY_AMOUNT_MINOR),
      currency,
      available: billingEnabled && readAmount(process.env.BILLING_WEEKLY_AMOUNT_MINOR) !== null,
      features: [
        'Full prediction board',
        'Match explanations and input snapshots',
        'Saved matches and preferences',
      ],
    },
    {
      id: 'monthly',
      name: 'Monthly Premium',
      interval: 'MONTHLY',
      amountMinor: readAmount(process.env.BILLING_MONTHLY_AMOUNT_MINOR),
      currency,
      available: billingEnabled && readAmount(process.env.BILLING_MONTHLY_AMOUNT_MINOR) !== null,
      features: [
        'Everything in Weekly',
        'Historical performance and evaluation detail',
        'Priority access to new validated markets',
      ],
    },
  ]

  return {
    billingEnabled,
    provider,
    notice: billingEnabled
      ? 'Billing is enabled. Checkout is hosted by the approved payment provider.'
      : 'Subscriptions are not open yet. Live billing stays disabled until the payment provider approves the business model, entity and target markets.',
    plans,
  }
}
