import { describe, expect, it } from 'vitest'
import { normalizeDepositMinMinor } from './deposit-settings'
import { adminDepositMinSchema, depositSchema } from './validation'

describe('deposit settings', () => {
  it('falls back to the default minimum for invalid values', () => {
    expect(normalizeDepositMinMinor(undefined)).toBe(5_000)
    expect(normalizeDepositMinMinor('not-a-number')).toBe(5_000)
    expect(normalizeDepositMinMinor(1.5)).toBe(5_000)
  })

  it('clamps a stored minimum to the allowed range', () => {
    expect(normalizeDepositMinMinor(0)).toBe(1)
    expect(normalizeDepositMinMinor(-100)).toBe(1)
    expect(normalizeDepositMinMinor(2_000_000)).toBe(1_000_000)
    expect(normalizeDepositMinMinor('7500')).toBe(7_500)
  })

  it('accepts deposits below the default so an admin can lower the limit', () => {
    expect(depositSchema.safeParse({ amountMinor: 500 }).success).toBe(true)
    expect(depositSchema.safeParse({ amountMinor: 0 }).success).toBe(false)
    expect(depositSchema.safeParse({ amountMinor: 1_000_001 }).success).toBe(false)
  })

  it('validates the admin minimum input', () => {
    expect(adminDepositMinSchema.safeParse({ amountMinor: 1 }).success).toBe(true)
    expect(adminDepositMinSchema.safeParse({ amountMinor: 1_000_000 }).success).toBe(true)
    expect(adminDepositMinSchema.safeParse({ amountMinor: 1_000_001 }).success).toBe(false)
  })
})
