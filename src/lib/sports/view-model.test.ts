import { describe, expect, it } from 'vitest'
import type { TeamFeatures } from '@/lib/predictions/engine'
import { mapMatchToFixture, type ApiMatch } from './football-data'
import type { Fixture, Team } from './provider'
import type { MatchAnalysis } from './service'
import { serializeMatchView } from './serialize'
import { buildMatchStatsView, toMatchView } from './view-model'

const NOW = new Date('2026-11-22T12:00:00.000Z')
const MINUTE = 60_000

function team(id: string, name: string): Team {
  return { id, name, shortName: name.slice(0, 3).toUpperCase(), color: '#9CA3AF' }
}

function teamFeatures(id: string): TeamFeatures {
  return {
    teamId: id,
    elo: 1500,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    form: [],
  }
}

function analysisFor(fixture: Fixture): MatchAnalysis {
  const home = team('home', 'Home FC')
  const away = team('away', 'Away FC')
  return {
    fixture,
    competition: { id: 'comp-1', name: 'League', sportId: 'football' },
    sport: { id: 'football', name: 'Football', slug: 'football' },
    home,
    away,
    features: {
      matchId: fixture.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      asOf: NOW,
      inputDataAsOf: null,
      home: teamFeatures(home.id),
      away: teamFeatures(away.id),
      source: 'provider',
      dataQualityFlags: [],
    },
    prediction: null,
    evaluation: null,
    explanation: null,
    isDemo: false,
  }
}

function fixtureWith(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'fx-1',
    competitionId: 'comp-1',
    sportId: 'football',
    homeTeamId: 'home',
    awayTeamId: 'away',
    kickoffUtc: new Date(NOW.getTime() - 26 * MINUTE),
    status: 'LIVE',
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  }
}

function apiMatch(overrides: Partial<ApiMatch> = {}): ApiMatch {
  return {
    id: 42,
    utcDate: NOW.toISOString(),
    status: 'IN_PLAY',
    competition: { id: 7, name: 'League', code: 'LEAGUE' },
    homeTeam: { id: 1, name: 'Home FC', shortName: 'HOM' },
    awayTeam: { id: 2, name: 'Away FC', shortName: 'AWY' },
    score: {
      duration: 'REGULAR',
      fullTime: { home: 1, away: 0 },
      halfTime: { home: 0, away: 0 },
    },
    venue: 'Example Arena',
    referee: 'Example Referee',
    ...overrides,
  }
}

describe('match view live state', () => {
  it('keeps a LIVE fixture with a score and passed kickoff live', () => {
    const view = toMatchView(analysisFor(fixtureWith()), 'UTC', NOW)
    expect(view.effectiveStatus).toBe('LIVE')
    expect(view.status).toBe('LIVE')
    expect(view.score).toEqual({ home: 1, away: 0 })
  })

  it('derives the live minute when the provider has none', () => {
    const view = toMatchView(analysisFor(fixtureWith()), 'UTC', NOW)
    expect(view.minute).toBe(26)
  })

  it('uses the provider minute when available', () => {
    const view = toMatchView(analysisFor(fixtureWith({ liveMinute: 73 })), 'UTC', NOW)
    expect(view.minute).toBe(73)
  })

  it('clamps derived minutes to 1..120', () => {
    const old = toMatchView(
      analysisFor(fixtureWith({ kickoffUtc: new Date(NOW.getTime() - 200 * MINUTE), homeScore: null, awayScore: null })),
      'UTC',
      NOW,
    )
    const future = toMatchView(
      analysisFor(fixtureWith({ kickoffUtc: new Date(NOW.getTime() + 10 * MINUTE), homeScore: null, awayScore: null })),
      'UTC',
      NOW,
    )
    expect(old.minute).toBe(120)
    expect(future.minute).toBe(1)
  })

  it('does not fake minutes for scheduled or finished fixtures', () => {
    const scheduled = toMatchView(
      analysisFor(fixtureWith({ status: 'SCHEDULED', homeScore: null, awayScore: null, kickoffUtc: new Date(NOW.getTime() - 60 * MINUTE) })),
      'UTC',
      NOW,
    )
    const finished = toMatchView(analysisFor(fixtureWith({ status: 'FINISHED' })), 'UTC', NOW)
    expect(scheduled.effectiveStatus).toBe('SCHEDULED')
    expect(scheduled.minute).toBeNull()
    expect(finished.effectiveStatus).toBe('FINISHED')
    expect(finished.minute).toBeNull()
  })

  it('exposes effectiveStatus and minute to API consumers', () => {
    const view = toMatchView(analysisFor(fixtureWith()), 'UTC', NOW)
    const serialized = serializeMatchView(view, { includeExplanation: false })
    expect(serialized.effectiveStatus).toBe('LIVE')
    expect(serialized.minute).toBe(26)
  })
})

describe('football-data mapping', () => {
  it('maps live scores, half-time scores, venue and referee', () => {
    const fixture = mapMatchToFixture(apiMatch())
    expect(fixture).not.toBeNull()
    expect(fixture?.status).toBe('LIVE')
    expect(fixture?.homeScore).toBe(1)
    expect(fixture?.awayScore).toBe(0)
    expect(fixture?.liveHomeScore).toBe(1)
    expect(fixture?.liveAwayScore).toBe(0)
    expect(fixture?.halfTimeHomeScore).toBe(0)
    expect(fixture?.halfTimeAwayScore).toBe(0)
    expect(fixture?.venue).toBe('Example Arena')
    expect(fixture?.referee).toBe('Example Referee')
    expect(fixture?.liveMinute).toBeNull()
  })

  it('treats PAUSED as live and does not set live scores for finished matches', () => {
    const paused = mapMatchToFixture(apiMatch({ status: 'PAUSED' }))
    const finished = mapMatchToFixture(apiMatch({ status: 'FINISHED' }))
    expect(paused?.status).toBe('LIVE')
    expect(finished?.status).toBe('FINISHED')
    expect(finished?.liveHomeScore).toBeNull()
    expect(finished?.liveAwayScore).toBeNull()
    expect(finished?.homeScore).toBe(1)
  })
})

describe('match stats view', () => {
  it('computes head to head from finished fixtures and carries new fixture fields', () => {
    const current = fixtureWith({ status: 'SCHEDULED', homeScore: null, awayScore: null })
    const previous = fixtureWith({
      id: 'fx-prev',
      status: 'FINISHED',
      kickoffUtc: new Date(NOW.getTime() - 7 * 24 * 60 * MINUTE),
      homeScore: 2,
      awayScore: 1,
    })
    const stats = buildMatchStatsView(
      analysisFor(current),
      [current, previous],
      [team('home', 'Home FC'), team('away', 'Away FC')],
      NOW,
    )
    expect(stats.h2h).toHaveLength(1)
    expect(stats.h2h[0]?.score).toEqual({ home: 2, away: 1 })
    expect(stats.h2h[0]?.result).toBe('W')
    expect(stats.form.home).toEqual([])
    expect(stats.venue).toBeNull()
  })
})
