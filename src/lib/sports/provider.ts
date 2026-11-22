export type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'

export interface Sport {
  id: string
  name: string
  slug: string
}

export interface Team {
  id: string
  name: string
  shortName: string
  color: string
  logoUrl?: string | null
  providerId?: string | null
}

export function fallbackLogoUrl(team: Pick<Team, 'name' | 'shortName' | 'color'>): string {
  const label =
    (team.shortName || team.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3) || 'FC'
  const color = /^#[0-9a-fA-F]{6}$/.test(team.color) ? team.color : '#334155'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><circle cx="32" cy="32" r="24" fill="rgba(255,255,255,0.18)"/><text x="32" y="39" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#fff">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export interface Competition {
  id: string
  name: string
  country?: string | null
  season?: string | null
  sportId: string
  providerId?: string | null
}

export interface Fixture {
  id: string
  providerId?: string | null
  competitionId: string
  sportId: string
  homeTeamId: string
  awayTeamId: string
  homeTeam?: Team
  awayTeam?: Team
  kickoffUtc: Date
  status: FixtureStatus
  homeScore?: number | null
  awayScore?: number | null
  liveMinute?: number | null
  liveHomeScore?: number | null
  liveAwayScore?: number | null
  halfTimeHomeScore?: number | null
  halfTimeAwayScore?: number | null
  venue?: string | null
  referee?: string | null
  lastSyncedAt?: Date | null
}

export interface ProviderHealth {
  ok: boolean
  mode: 'demo' | 'live' | 'stored' | 'unavailable'
  message: string
}

/**
 * Provider-independent sports data contract. A production adapter must map its
 * payloads into these types and persist provider IDs plus sync timestamps.
 */
export interface SportsDataProvider {
  name: string
  getSports(): Promise<Sport[]>
  getCompetitions(): Promise<Competition[]>
  getTeams(): Promise<Team[]>
  getFixtures(from: Date, to: Date): Promise<Fixture[]>
  getFixture(fixtureId: string): Promise<Fixture | null>
  getHealth(): Promise<ProviderHealth>
}
