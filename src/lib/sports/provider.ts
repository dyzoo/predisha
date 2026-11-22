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
  const color = /^#[0-9a-fA-F]{6}$/.test(team.color) ? team.color : '#334155'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4 54 12v18c0 14-9 23-22 30C19 53 10 44 10 30V12Z" fill="${color}"/><path d="M32 9 49 15v15c0 11-7 18-17 24C22 48 15 41 15 30V15Z" fill="#fff" fill-opacity=".12"/><circle cx="32" cy="29" r="10" fill="#fff" fill-opacity=".92"/><path d="m32 22 5 3.5-1.8 5.9h-6.4L27 25.5Z" fill="${color}"/><path d="M32 19v20M22 29h20" stroke="${color}" stroke-width="2" stroke-opacity=".35"/></svg>`
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
