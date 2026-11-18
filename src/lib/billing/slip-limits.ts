import type { Entitlement } from '@/lib/auth/entitlements'

export interface SlipLimitPlan {
  slipLimit?: number | null
  weeklyLimit?: number | null
  monthlyLimit?: number | null
}

export function resolveSlipLimit(params: {
  entitlement: Entitlement
  plan: SlipLimitPlan | null
}): number | null {
  if (params.entitlement === 'ADMIN') return null
  const limit =
    params.plan?.slipLimit ?? params.plan?.monthlyLimit ?? params.plan?.weeklyLimit ?? null
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
    ? Math.floor(limit)
    : null
}

export function hasSlipLimitRemaining(limit: number | null, used: number): boolean {
  return limit === null || used < limit
}
