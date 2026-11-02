import type {
  Competition,
  Fixture,
  FixtureStatus,
  ProviderHealth,
  Sport,
  SportsDataProvider,
  Team,
} from './provider'

const BASE_URL = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4'
const API_TOKEN = process.env.FOOTBALL_DATA_API_TOKEN ?? ''
const PROVIDER_NAME = 'football-data'

const DEFAULT_TEAM_COLOR = '#9CA3AF'

const DAY_MS = 24 * 60 * 60 * 1000
// football-data.org rejects `/matches` ranges longer than 10 days.
const MAX_RANGE_DAYS = 10

function chunkDateRange(from: Date, to: Date): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = []
  let start = new Date(from)
  while (start.getTime() <= to.getTime()) {
    const end = new Date(
      Math.min(start.getTime() + (MAX_RANGE_DAYS - 1) * DAY_MS, to.getTime()),
    )
    chunks.push({ from: start, to: end })
    start = new Date(end.getTime() + DAY_MS)
  }
  return chunks
}

function apiStatusToFixtureStatus(status: string): FixtureStatus {
  switch (status) {
    case 'SCHEDULED':
      return 'SCHEDULED'
    case 'LIVE':
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE'
    case 'FINISHED':
      return 'FINISHED'
    case 'POSTPONED':
      return 'POSTPONED'
    case 'CANCELLED':
      return 'CANCELLED'
    case 'SUSPENDED':
    case 'ABANDONED':
      return 'ABANDONED'
    default:
      return 'SCHEDULED'
  }
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function mapMatchToFixture(match: ApiMatch): Fixture | null {
  const kickoff = toDate(match.utcDate)
  if (!kickoff) return null
  if (match.homeTeam?.id == null || match.awayTeam?.id == null) return null
  if (match.competition?.id == null) return null
  const homeScore = match.score.fullTime?.home ?? null
  const awayScore = match.score.fullTime?.away ?? null
  return {
    id: String(match.id),
    providerId: String(match.id),
    competitionId: String(match.competition.id),
    sportId: 'football',
    homeTeamId: String(match.homeTeam.id),
    awayTeamId: String(match.awayTeam.id),
    homeTeam: teamFromApi(match.homeTeam),
    awayTeam: teamFromApi(match.awayTeam),
    kickoffUtc: kickoff,
    status: apiStatusToFixtureStatus(match.status),
    homeScore: typeof homeScore === 'number' ? homeScore : null,
    awayScore: typeof awayScore === 'number' ? awayScore : null,
    lastSyncedAt: new Date(),
  }
}

function teamFromApi(team: ApiMatch['homeTeam']): Team {
  const id = String(team.id)
  const name = team.name?.trim() || `Team ${id}`
  return {
    id,
    name,
    shortName: team.shortName?.trim() || name.slice(0, 3).toUpperCase(),
    color: DEFAULT_TEAM_COLOR,
    logoUrl: team.crest ?? null,
    providerId: id,
  }
}

async function request<T>(path: string): Promise<T> {
  if (!API_TOKEN) {
    throw new Error('FOOTBALL_DATA_API_TOKEN is not configured')
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': API_TOKEN },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('football-data.org API token is invalid or lacks access to this endpoint.')
    }
    if (res.status === 429) {
      throw new Error('football-data.org API rate limit exceeded. Try again later.')
    }
    throw new Error(
      `football-data.org API error: ${res.status} ${res.statusText}`,
    )
  }
  return (await res.json()) as T
}

async function fetchMatches(from: Date, to: Date): Promise<ApiMatch[]> {
  const matches: ApiMatch[] = []
  for (const chunk of chunkDateRange(from, to)) {
    const dateFrom = chunk.from.toISOString().slice(0, 10)
    const dateTo = chunk.to.toISOString().slice(0, 10)
    const { matches: chunkMatches } = await request<{ matches: ApiMatch[] }>(
      `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    )
    matches.push(...chunkMatches)
  }
  return matches
}

interface ApiCompetition {
  id: number
  name: string
  area: { name: string }
  currentSeason?: { startDate?: string; endDate?: string } | null
  emblem?: string | null
}

interface ApiStanding {
  stage?: string | null
  type?: string | null
  table: Array<{
    position: number
    team: { id: number; name: string; shortName: string; crest?: string | null }
    playedGames: number
    won: number
    draw: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
    form?: string | null
  }>
}

interface ApiMatch {
  id: number
  utcDate: string
  status: string
  competition: { id: number; name: string; code: string } | null
  homeTeam: { id: number | null; name: string | null; shortName: string | null; crest?: string | null }
  awayTeam: { id: number | null; name: string | null; shortName: string | null; crest?: string | null }
  score: {
    fullTime?: { home?: number | null; away?: number | null } | null
  }
}

export class FootballDataProvider implements SportsDataProvider {
  name = PROVIDER_NAME

  async getSports(): Promise<Sport[]> {
    return [{ id: 'football', name: 'Football', slug: 'football' }]
  }

  async getCompetitions(): Promise<Competition[]> {
    try {
      const { competitions } = await request<{ competitions: ApiCompetition[] }>(
        '/competitions',
      )
      return competitions.map(item => ({
        id: String(item.id),
        name: item.name,
        country: item.area?.name ?? null,
        season: item.currentSeason
          ? `${item.currentSeason.startDate ?? ''}-${item.currentSeason.endDate ?? ''}`.replace(/-$/, '') || null
          : null,
        sportId: 'football',
        providerId: String(item.id),
      }))
    } catch {
      return []
    }
  }

  async getTeams(): Promise<Team[]> {
    const now = new Date()
    const from = new Date(now.getTime() - 3 * DAY_MS)
    const to = new Date(now.getTime() + 6 * DAY_MS)

    try {
      const matches = await fetchMatches(from, to)
      const teamsById = new Map<number, Team>()
      for (const match of matches) {
        for (const team of [match.homeTeam, match.awayTeam]) {
          if (team?.id == null) continue
          if (teamsById.has(team.id)) continue
          teamsById.set(team.id, teamFromApi(team))
        }
      }
      return Array.from(teamsById.values())
    } catch {
      return []
    }
  }

  async getFixtures(from: Date, to: Date): Promise<Fixture[]> {
    return this.getUpcomingFixtures(from, to)
  }

  async getFixture(fixtureId: string): Promise<Fixture | null> {
    return this.getFixtureDetails(fixtureId)
  }

  async getHealth(): Promise<ProviderHealth> {
    if (!API_TOKEN) {
      return {
        ok: false,
        mode: 'unavailable',
        message:
          'FOOTBALL_DATA_API_TOKEN is not configured. Live fixtures and predictions are unavailable.',
      }
    }
    try {
      await request<{ competitions: unknown[] }>('/competitions')
      return {
        ok: true,
        mode: 'live',
        message: 'football-data.org API reachable.',
      }
    } catch (error) {
      return {
        ok: false,
        mode: 'unavailable',
        message:
          error instanceof Error
            ? `football-data.org API error: ${error.message}`
            : 'football-data.org API is unavailable.',
      }
    }
  }

  /* === MD-specified adapter methods === */

  async getUpcomingFixtures(
    from: Date,
    to: Date,
    competitions?: string[],
  ): Promise<Fixture[]> {
    const matches = await fetchMatches(from, to)
    return matches
      .map(match => mapMatchToFixture(match))
      .filter((item): item is Fixture => item !== null)
      .filter(fixture => {
        if (fixture.kickoffUtc < from || fixture.kickoffUtc > to) return false
        if (competitions && competitions.length > 0) {
          return competitions.includes(fixture.competitionId)
        }
        return true
      })
      .sort(
        (a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime(),
      )
  }

  async getFixtureDetails(fixtureId: string): Promise<Fixture | null> {
    try {
      const { match } = await request<{ match: ApiMatch }>(`/matches/${fixtureId}`)
      return mapMatchToFixture(match)
    } catch {
      return null
    }
  }

  async getRecentResults(teamId: string, limit = 5): Promise<Fixture[]> {
    const now = new Date()
    const from = new Date(now.getTime() - 90 * DAY_MS)
    const matches = await fetchMatches(from, now)
    return matches
      .map(match => mapMatchToFixture(match))
      .filter((item): item is Fixture => item !== null)
      .filter(
        fixture =>
          fixture.status === 'FINISHED' &&
          (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
      )
      .sort(
        (a, b) =>
          b.kickoffUtc.getTime() - a.kickoffUtc.getTime(),
      )
      .slice(0, limit)
  }

  async getStandings(
    competitionId: string,
  ): Promise<Array<{
    position: number
    teamId: string
    teamName: string
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
  }>> {
    try {
      const { standings } = await request<{ standings: ApiStanding[] }>(
        `/competitions/${competitionId}/standings`,
      )
      const totalStanding = standings.find(
        s => s.type === 'TOTAL' || !s.type,
      )
      if (!totalStanding) return []
      return totalStanding.table.map(row => ({
        position: row.position,
        teamId: String(row.team.id),
        teamName: row.team.name,
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      }))
    } catch {
      return []
    }
  }

  async getTeamStatistics(): Promise<Record<string, number | string | null>> {
    // Free tier does not provide dedicated team statistics. Return empty record
    // rather than fabricating data. Callers should treat missing stats honestly.
    return {}
  }
}

export function isFootballDataEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (process.env.SPORTS_DATA_PROVIDER ?? 'demo').toLowerCase() === PROVIDER_NAME
  )
}
