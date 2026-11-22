import { describe, expect, it } from 'vitest'
import { buildBetEvent } from './catalog'
import type { MatchAnalysis } from '@/lib/sports/service'

function analysis(): MatchAnalysis {
  return {
    fixture: {
      id: '12345',
      providerId: '12345',
      competitionId: 'PL',
      sportId: 'football',
      homeTeamId: '1',
      awayTeamId: '2',
      kickoffUtc: new Date('2026-01-01T12:00:00.000Z'),
      status: 'LIVE',
      homeScore: null,
      awayScore: null,
      liveHomeScore: 2,
      liveAwayScore: 1,
      liveMinute: 67,
      halfTimeHomeScore: 1,
      halfTimeAwayScore: 0,
    },
    competition: {
      id: 'PL',
      name: 'Premier League',
      country: 'England',
      season: '2025-2026',
      sportId: 'football',
      providerId: 'PL',
    },
    sport: { id: 'football', name: 'Football', slug: 'football' },
    home: { id: '1', name: 'Home FC', shortName: 'HOM', color: '#111111' },
    away: { id: '2', name: 'Away FC', shortName: 'AWY', color: '#222222' },
    features: {} as never,
    prediction: null,
    evaluation: null,
    explanation: null,
    isDemo: false,
  }
}

describe('buildBetEvent live scores', () => {
  it('uses provider live score and minute fields for live fixtures', () => {
    const event = buildBetEvent(analysis(), new Date('2026-01-01T12:10:00.000Z'))

    expect(event.live).toBe(true)
    expect(event.score).toEqual({ home: 2, away: 1 })
    expect(event.minute).toBe(67)
  })

  it('falls back to final score when a live fixture has no live score', () => {
    const finished = analysis()
    finished.fixture = {
      ...finished.fixture,
      status: 'FINISHED',
      homeScore: 3,
      awayScore: 0,
      liveHomeScore: null,
      liveAwayScore: null,
      liveMinute: null,
    }

    const event = buildBetEvent(finished, new Date('2026-01-01T14:00:00.000Z'))

    expect(event.live).toBe(false)
    expect(event.score).toEqual({ home: 3, away: 0 })
    expect(event.minute).toBeNull()
  })
})
