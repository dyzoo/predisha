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
