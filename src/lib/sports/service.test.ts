import { describe, expect, it } from 'vitest'
import { buildMatchAnalyses, type SportsDataset } from './service'
import type { Fixture, Team } from './provider'

const now = new Date('2026-11-24T12:00:00.000Z')

const teams: Team[] = [
  { id: 'team-a', name: 'Team A', shortName: 'TMA', color: '#E41827' },
  { id: 'team-b', name: 'Team B', shortName: 'TMB', color: '#5B8CFF' },
]

const target: Fixture = {
  id: 'target',
  competitionId: 'competition-1',
  sportId: 'football',
  homeTeamId: 'team-a',
  awayTeamId: 'team-b',
  kickoffUtc: new Date('2026-11-25T20:00:00.000Z'),
  status: 'SCHEDULED',
}

const history: Fixture[] = [10, 8, 6, 4].map((days, index) => ({
  id: `history-${index}`,
  competitionId: 'competition-1',
  sportId: 'football',
  homeTeamId: 'team-a',
  awayTeamId: 'team-b',
  kickoffUtc: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  status: 'FINISHED',
  homeScore: index % 2 === 0 ? 2 : 1,
  awayScore: index % 2 === 0 ? 0 : 1,
}))

function dataset(modelFixtures: Fixture[]): SportsDataset {
  return {
    sportList: [{ id: 'football', name: 'Football', slug: 'football' }],
    competitions: [
      {
        id: 'competition-1',
        name: 'Test League',
        country: null,
        season: null,
        sportId: 'football',
        providerId: null,
      },
    ],
    teams,
    fixtures: [target],
    modelFixtures,
    health: { ok: true, mode: 'stored', message: 'test dataset' },
    isDemo: false,
  }
}

describe('model history inputs', () => {
  it('uses real finished history for predictions without exposing it as fixtures', () => {
    const withoutHistory = buildMatchAnalyses(dataset([]), now)
    expect(withoutHistory).toHaveLength(1)
    expect(withoutHistory[0]?.prediction).toBeNull()

    const withHistory = buildMatchAnalyses(dataset(history), now)
    expect(withHistory).toHaveLength(1)
    expect(withHistory[0]?.prediction).not.toBeNull()
    expect(withHistory[0]?.features.home.matches).toBe(4)
    expect(withHistory[0]?.features.away.matches).toBe(4)
  })
})
