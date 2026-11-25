import { describe, expect, it } from 'vitest'
import { matchesBetEventQuery, normalizeSearchText, searchBetEvents } from './search'
import type { BetEvent } from './types'

function event(home: string, away: string, competition = 'Premier League'): BetEvent {
  return {
    id: `${home}-${away}`,
    competition,
    competitionId: 'comp-1',
    sport: 'Football',
    sportId: 'football',
    status: 'SCHEDULED',
    effectiveStatus: 'SCHEDULED',
    live: false,
    home: { id: home, name: home, short: home.slice(0, 3).toUpperCase(), color: '#fff' },
    away: { id: away, name: away, short: away.slice(0, 3).toUpperCase(), color: '#000' },
    kickoffIso: '2026-11-26T20:00:00.000Z',
    kickoffLabel: 'Thu 26 Nov, 23:00',
    score: null,
    minute: null,
    markets: [],
    probability: null,
    expectedGoals: null,
    modelVersion: null,
    simulated: true,
    oddsAsOf: '2026-11-25T00:00:00.000Z',
    sourceLabel: 'Fixture feed',
  }
}

describe('bet fixture search', () => {
  const fixtures = [
    event('Arsenal', 'Liverpool'),
    event('Manchester City', 'Chelsea'),
    event('Real Madrid', 'Barcelona', 'La Liga'),
  ]

  it('normalizes accents and punctuation', () => {
    expect(normalizeSearchText('Atlético  Madrid!')).toBe('atletico madrid')
  })

  it('matches a team name or short name', () => {
    expect(matchesBetEventQuery(fixtures[0]!, 'Liverpool')).toBe(true)
    expect(matchesBetEventQuery(fixtures[0]!, 'ARS')).toBe(true)
    expect(matchesBetEventQuery(fixtures[0]!, 'Chelsea')).toBe(false)
  })

  it('matches a match query with versus separators', () => {
    expect(matchesBetEventQuery(fixtures[0]!, 'Arsenal vs Liverpool')).toBe(true)
    expect(matchesBetEventQuery(fixtures[2]!, 'Real Madrid Barcelona')).toBe(true)
  })

  it('returns matching fixtures as suggestions', () => {
    expect(searchBetEvents(fixtures, 'madrid').map(item => item.id)).toEqual([
      'Real Madrid-Barcelona',
    ])
    expect(searchBetEvents(fixtures, 'premier').map(item => item.id)).toEqual([
      'Arsenal-Liverpool',
      'Manchester City-Chelsea',
    ])
  })
})
