import { describe, expect, it } from 'vitest'
import { hasSlipLimitRemaining, resolveSlipLimit } from './slip-limits'

describe('slip limits', () => {
  it('uses the plan slip limit for paying users', () => {
    expect(resolveSlipLimit({ entitlement: 'PREMIUM', plan: { slipLimit: 5 } })).toBe(5)
    expect(resolveSlipLimit({ entitlement: 'PREMIUM', plan: { slipLimit: 15 } })).toBe(15)
    expect(resolveSlipLimit({ entitlement: 'PREMIUM', plan: { slipLimit: 25 } })).toBe(25)
  })

  it('leaves admins unlimited and free users on the free preview', () => {
    expect(resolveSlipLimit({ entitlement: 'ADMIN', plan: { slipLimit: 25 } })).toBeNull()
    expect(resolveSlipLimit({ entitlement: 'FREE', plan: null })).toBeNull()
  })

  it('falls back to legacy limits and blocks overages', () => {
    expect(resolveSlipLimit({ entitlement: 'PREMIUM', plan: { weeklyLimit: 7 } })).toBe(7)
    expect(resolveSlipLimit({ entitlement: 'PREMIUM', plan: { monthlyLimit: 11 } })).toBe(11)
    expect(hasSlipLimitRemaining(5, 4)).toBe(true)
    expect(hasSlipLimitRemaining(5, 5)).toBe(false)
    expect(hasSlipLimitRemaining(null, 100)).toBe(true)
  })
})
