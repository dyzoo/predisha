import { describe, expect, it } from 'vitest'
import { buildRandomSelections, RANDOM_TEAM_GROUPS } from './random-teams'

describe('buildRandomSelections', () => {
  it('builds unique custom one-result picks from the chosen pool', () => {
    const picks = buildRandomSelections({
      count: 8,
      kickoffIso: '2026-01-01T12:00:00.000Z',
      leagueName: 'Spain — Segunda División',
      prefix: 'test-random',
    })

    expect(picks).toHaveLength(8)
    expect(new Set(picks.map(pick => pick.fixtureId)).size).toBe(8)
    expect(picks.every(pick => pick.custom)).toBe(true)
    expect(picks.every(pick => pick.marketId === '1x2')).toBe(true)
    expect(picks.every(pick => ['HOME', 'DRAW', 'AWAY'].includes(pick.selectionId))).toBe(true)
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
