import { describe, expect, it } from 'vitest'
import { settleMarket } from './odds'
import { buildRandomSelections, RANDOM_MARKET_SPECS, RANDOM_TEAM_GROUPS } from './random-teams'

describe('buildRandomSelections', () => {
  it('builds unique custom picks across the original markets from the chosen pool', () => {
    const picks = buildRandomSelections({
      count: 30,
      kickoffIso: '2026-01-01T12:00:00.000Z',
      leagueName: 'Spain — Segunda División',
      prefix: 'test-random',
    })

    expect(picks).toHaveLength(30)
    expect(new Set(picks.map(pick => pick.fixtureId)).size).toBe(30)
    expect(picks.every(pick => pick.custom)).toBe(true)
    expect(
      picks.every(pick =>
        RANDOM_MARKET_SPECS.some(spec =>
          spec.marketId === pick.marketId &&
          spec.selectionId === pick.selectionId &&
          spec.selectionLabel === pick.selectionLabel &&
          spec.probability === pick.probability,
        ),
      ),
    ).toBe(true)
    expect(new Set(picks.map(pick => pick.marketId)).size).toBeGreaterThan(1)
    expect(picks.every(pick => pick.odds >= 1.01 && pick.odds <= 1000)).toBe(true)

    const pool = RANDOM_TEAM_GROUPS.find(group => group.name === 'Spain — Segunda División')
    expect(pool).toBeDefined()
    for (const pick of picks) {
      const teams = pick.fixtureLabel.split(' vs ')
      expect(teams).toHaveLength(2)
      expect(pool?.teams).toContain(teams[0])
      expect(pool?.teams).toContain(teams[1])
    }
  })

  it('uses selections supported by the settlement engine', () => {
    expect(
      RANDOM_MARKET_SPECS.every(spec => settleMarket(spec.selectionId, 2, 1) !== null),
    ).toBe(true)
  })

  it('reuses the same fixtures for the same seed', () => {
    const input = {
      count: 4,
      kickoffIso: '2026-01-01T12:00:00.000Z',
      leagueName: 'ANY',
      prefix: 'stable-seed',
    }
    expect(buildRandomSelections(input)).toEqual(buildRandomSelections(input))
  })
})
