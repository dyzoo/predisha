const DAY_MS = 24 * 60 * 60 * 1000

export interface PlanDurationSource {
  interval: string
  durationDays?: number | null
}

export function planDurationDays(plan: PlanDurationSource): number {
  if (plan.durationDays && plan.durationDays > 0) return plan.durationDays
  return plan.interval.toUpperCase() === 'WEEKLY' ? 7 : 30
}

export function planDurationMs(plan: PlanDurationSource): number {
  return planDurationDays(plan) * DAY_MS
}
