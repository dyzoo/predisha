import { FootballDataProvider } from './football-data'
import type {
  Competition,
  Fixture,
  ProviderHealth,
  Sport,
  SportsDataProvider,
  Team,
} from './provider'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

export interface DemoTeam extends Team {
  strength: number
}

export interface DemoCompetition extends Competition {
  teamIds: string[]
}

export interface DemoDataset {
  sports: Sport[]
  competitions: DemoCompetition[]
  teams: DemoTeam[]
  fixtures: Fixture[]
}

const TEAMS: DemoTeam[] = [
  { id: 'demo-northbridge', name: 'Northbridge FC', shortName: 'NBR', color: '#5B8CFF', strength: 1.28, providerId: 'demo-northbridge' },
  { id: 'demo-atlas', name: 'Atlas United', shortName: 'ATL', color: '#FF7A59', strength: 1.12, providerId: 'demo-atlas' },
  { id: 'demo-harbor', name: 'Harbor City', shortName: 'HBR', color: '#2FD3A5', strength: 1.05, providerId: 'demo-harbor' },
  { id: 'demo-meridian', name: 'Meridian Rovers', shortName: 'MER', color: '#F5C542', strength: 0.98, providerId: 'demo-meridian' },
  { id: 'demo-kingsport', name: 'Kingsport Athletic', shortName: 'KPA', color: '#C8FF43', strength: 1.18, providerId: 'demo-kingsport' },
  { id: 'demo-vale', name: 'Vale Sporting', shortName: 'VLS', color: '#9B8CFF', strength: 0.9, providerId: 'demo-vale' },
  { id: 'demo-eastgate', name: 'Eastgate FC', shortName: 'EGT', color: '#FF5CA8', strength: 1.14, providerId: 'demo-eastgate' },
  { id: 'demo-summit', name: 'Summit Wanderers', shortName: 'SMW', color: '#4FD1FF', strength: 1.08, providerId: 'demo-summit' },
  { id: 'demo-redcliff', name: 'Redcliff Town', shortName: 'RCT', color: '#FFB35C', strength: 0.94, providerId: 'demo-redcliff' },
  { id: 'demo-aurora', name: 'Aurora FC', shortName: 'AUR', color: '#79E0A3', strength: 1.02, providerId: 'demo-aurora' },
  { id: 'demo-quarry', name: 'Quarry Lane', shortName: 'QRL', color: '#E0C46A', strength: 0.88, providerId: 'demo-quarry' },
  { id: 'demo-lumen', name: 'Lumen Park', shortName: 'LMP', color: '#8FB4FF', strength: 1.22, providerId: 'demo-lumen' },
]

const COMPETITIONS: DemoCompetition[] = [
  {
    id: 'demo-premier',
    name: 'Demo Premier Division',
    country: 'Demo',
    season: 'Demo season 2026',
    sportId: 'football',
    providerId: 'demo-premier',
    teamIds: ['demo-northbridge', 'demo-atlas', 'demo-harbor', 'demo-meridian', 'demo-kingsport', 'demo-vale'],
  },
  {
    id: 'demo-cup',
    name: 'Demo Continental Cup',
    country: 'Demo',
    season: 'Demo season 2026',
    sportId: 'football',
    providerId: 'demo-cup',
    teamIds: ['demo-eastgate', 'demo-summit', 'demo-redcliff', 'demo-aurora', 'demo-quarry', 'demo-lumen'],
  },
]

const SPORTS: Sport[] = [{ id: 'football', name: 'Football', slug: 'football' }]

const PAST_ROUNDS = 7
const FUTURE_ROUNDS = 3

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function poissonSample(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda)
  let product = 1
  let goals = 0
  do {
    goals += 1
    product *= random()
  } while (product > limit && goals < 8)
  return goals - 1
}

function roundPairings(teamIds: string[], round: number): Array<[string, string]> {
  const count = teamIds.length
  const rotation = round % Math.max(1, count - 1)
  const rotating = teamIds.slice(1)
  const ordered = [
    teamIds[0],
    ...rotating.slice(rotation),
    ...rotating.slice(0, rotation),
  ]
  const pairs: Array<[string, string]> = []
  for (let index = 0; index < count / 2; index += 1) {
    const home = ordered[index]
    const away = ordered[count - 1 - index]
    pairs.push((round + index) % 2 === 0 ? [home, away] : [away, home])
  }
  return pairs
}

function scoreFor(
  home: DemoTeam,
  away: DemoTeam,
  seed: string,
): { home: number; away: number } {
  const random = mulberry32(hashString(seed))
  const leagueAverage = 1.35
  const homeExpected = Math.min(
    4.2,
    Math.max(0.2, leagueAverage * (home.strength / away.strength) * 1.16),
  )
  const awayExpected = Math.min(
    4.2,
    Math.max(0.15, leagueAverage * (away.strength / home.strength) * 0.92),
  )
  return {
    home: poissonSample(homeExpected, random),
    away: poissonSample(awayExpected, random),
  }
}

/**
 * Builds a deterministic fictional dataset. Dates are anchored to `anchor`
 * so the demo always has relevant recent form and upcoming fixtures.
 */
export function buildDemoDataset(anchor: Date = new Date()): DemoDataset {
  const teamsById = new Map(TEAMS.map(team => [team.id, team]))
  const fixtures: Fixture[] = []

  for (const competition of COMPETITIONS) {
    for (let round = 0; round < PAST_ROUNDS + FUTURE_ROUNDS; round += 1) {
      const pairs = roundPairings(competition.teamIds, round)
      const isPast = round < PAST_ROUNDS

      pairs.forEach(([homeId, awayId], index) => {
        const home = teamsById.get(homeId)
        const away = teamsById.get(awayId)
        if (!home || !away) return

        const id = `demo-${competition.id}-${round}-${index}`
        if (isPast) {
          const kickoff = new Date(
            anchor.getTime() - (PAST_ROUNDS - round) * 7 * DAY - index * 2 * HOUR,
          )
          kickoff.setUTCHours(13 + index * 2, 30, 0, 0)
          const score = scoreFor(home, away, id)
          fixtures.push({
            id,
            providerId: id,
            competitionId: competition.id,
            sportId: competition.sportId,
            homeTeamId: home.id,
            awayTeamId: away.id,
            kickoffUtc: kickoff,
            status: 'FINISHED',
            homeScore: score.home,
            awayScore: score.away,
            lastSyncedAt: anchor,
          })
          return
        }

        const futureRound = round - PAST_ROUNDS
        const isLive = futureRound === 0 && index === 0
        const kickoff = isLive
          ? new Date(anchor.getTime() - 26 * 60 * 1000)
          : new Date(anchor.getTime() + (futureRound + 1) * 2 * DAY + index * 3 * HOUR)
        if (!isLive) {
          kickoff.setUTCHours(16 + index, 0, 0, 0)
        }

        fixtures.push({
          id,
          providerId: id,
          competitionId: competition.id,
          sportId: competition.sportId,
          homeTeamId: home.id,
          awayTeamId: away.id,
          kickoffUtc: kickoff,
          status: isLive ? 'LIVE' : 'SCHEDULED',
          homeScore: isLive ? 1 : null,
          awayScore: isLive ? 0 : null,
          lastSyncedAt: anchor,
        })
      })
    }
  }

  fixtures.sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())

  return {
    sports: SPORTS,
    competitions: COMPETITIONS,
    teams: TEAMS,
    fixtures,
  }
}

export function isDemoDataEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && (process.env.SPORTS_DATA_PROVIDER ?? 'demo') === 'demo'
}

export class DemoSportsProvider implements SportsDataProvider {
  name = 'demo'
  private readonly anchor: Date
  private cached: DemoDataset | null = null

  constructor(anchor: Date = new Date()) {
    this.anchor = anchor
  }

  private get dataset(): DemoDataset {
    if (!this.cached) this.cached = buildDemoDataset(this.anchor)
    return this.cached
  }

  async getSports(): Promise<Sport[]> {
    return isDemoDataEnabled() ? this.dataset.sports : []
  }

  async getCompetitions(): Promise<Competition[]> {
    if (!isDemoDataEnabled()) return []
    return this.dataset.competitions.map(competition => ({
      id: competition.id,
      name: competition.name,
      country: competition.country,
      season: competition.season,
      sportId: competition.sportId,
      providerId: competition.providerId,
    }))
  }

  async getTeams(): Promise<Team[]> {
    if (!isDemoDataEnabled()) return []
    return this.dataset.teams
  }

  async getFixtures(from: Date, to: Date): Promise<Fixture[]> {
    if (!isDemoDataEnabled()) return []
    return this.dataset.fixtures.filter(
      fixture => fixture.kickoffUtc >= from && fixture.kickoffUtc <= to,
    )
  }

  async getFixture(fixtureId: string): Promise<Fixture | null> {
    if (!isDemoDataEnabled()) return null
    return this.dataset.fixtures.find(fixture => fixture.id === fixtureId) ?? null
  }

  async getHealth(): Promise<ProviderHealth> {
    if (isDemoDataEnabled()) {
      return {
        ok: true,
        mode: 'demo',
        message:
          'Demo mode active: fictional fixtures and illustrative probabilities are shown for local development only.',
      }
    }
    return {
      ok: false,
      mode: 'unavailable',
      message:
        'No production sports data credentials are configured. Live fixtures and predictions are unavailable.',
    }
  }
}

/**
 * Honest empty state used when no production adapter is configured. It never
 * fabricates fixtures, even in production.
 */
export class UnavailableSportsProvider implements SportsDataProvider {
  name = 'unavailable'

  async getSports(): Promise<Sport[]> {
    return []
  }

  async getCompetitions(): Promise<Competition[]> {
    return []
  }

  async getTeams(): Promise<Team[]> {
    return []
  }

  async getFixtures(): Promise<Fixture[]> {
    return []
  }

  async getFixture(): Promise<Fixture | null> {
    return null
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      ok: false,
      mode: 'unavailable',
      message:
        'No production sports data credentials are configured. Live fixtures and predictions are unavailable.',
    }
  }
}

export function getSportsProvider(): SportsDataProvider {
  const provider = (process.env.SPORTS_DATA_PROVIDER ?? 'demo').toLowerCase()
  if (provider === 'demo') {
    return new DemoSportsProvider()
  }
  if (provider === 'football-data') {
    return new FootballDataProvider()
  }
  return new UnavailableSportsProvider()
}
