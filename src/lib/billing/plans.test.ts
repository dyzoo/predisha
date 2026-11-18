import { describe, expect, it } from 'vitest'
import { formatPlanAmount, planIntervalForDuration, PLAN_DEFAULTS } from './plans'
import { planDurationMs } from './duration'

describe('AI prediction plans', () => {
  it('publishes the requested prices, durations and slip limits', () => {
    expect(
      PLAN_DEFAULTS.map(({ id, name, amountMinor, currency, durationDays, slipLimit }) => ({
        id,
        name,
        amountMinor,
        currency,
        durationDays,
        slipLimit,
      })),
    ).toEqual([
      {
        id: 'weekly',
        name: 'Weekly',
        amountMinor: 2000,
        currency: 'TZS',
        durationDays: 7,
        slipLimit: 5,
      },
      {
        id: 'monthly',
        name: 'Monthly',
        amountMinor: 5000,
        currency: 'TZS',
        durationDays: 30,
        slipLimit: 15,
      },
      {
        id: 'quarterly',
        name: '3 Months',
        amountMinor: 12000,
        currency: 'TZS',
        durationDays: 90,
        slipLimit: 25,
      },
    ])
  })

  it('formats TZS amounts as whole shillings', () => {
    expect(formatPlanAmount(2000, 'TZS').replace(/\u00a0/g, ' ')).toContain('2,000')
    expect(formatPlanAmount(12000, 'TZS').replace(/\u00a0/g, ' ')).toContain('12,000')
  })

  it('derives the public interval and billing period from duration', () => {
    expect(planIntervalForDuration(7)).toBe('WEEKLY')
    expect(planIntervalForDuration(30)).toBe('MONTHLY')
    expect(planIntervalForDuration(90)).toBe('QUARTERLY')
    expect(planDurationMs({ interval: 'MONTHLY', durationDays: 90 })).toBe(90 * 24 * 60 * 60 * 1000)
  })
})
