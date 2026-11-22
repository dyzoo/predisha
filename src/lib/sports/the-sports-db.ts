import { fallbackLogoUrl, type Competition, type Fixture, type FixtureStatus, type ProviderHealth, type Sport, type SportsDataProvider, type Team } from './provider'

const API_KEY = process.env.THESPORTSDB_API_KEY ?? '123'
const LEAGUE_IDS = [
  '4328',
  '4329',
  '4330',
  '4331',
  '4332',
  '4334',
  '4335',
  '4336',
  '4337',
  '4338',
  '4480',
  '4481',
  '4490',
]
const CACHE_MS = 10 * 60 * 1000
const TEAM_COLORS = ['#5B8CFF', '#E41827', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16']

interface TheSportsDBEvent {
  idEvent?: string | null
  strTimestamp?: string | null
  dateEvent?: string | null
  strTime?: string | null
  idLeague?: string | null
  strLeague?: string | null
  strSeason?: string | null
  strHomeTeam?: string | null
  strAwayTeam?: string | null
  idHomeTeam?: string | null
  idAwayTeam?: string | null
  strHomeTeamBadge?: string | null
  strAwayTeamBadge?: string | null
  strStatus?: string | null
  strVenue?: string | null
  intHomeScore?: string | null
  intAwayScore?: string | null
}

interface TheSportsDBDataset {
  sports: Sport[]
  competitions: Competition[]
  teams: Team[]
  fixtures: Fixture[]
}

let cached: { expiresAt: number; dataset: TheSportsDBDataset } | null = null
let pending: Promise<TheSportsDBDataset> | null = null

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

function colorFor(name: string): string {
  return TEAM_COLORS[hash(name) % TEAM_COLORS.length]
}

function shortNameFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return parts.map(part => part[0]).join('').slice(0, 3).toUpperCase()
}

function badgeUrl(value: string | null | undefined, name: string, color: string): string {
  const trimmed = value?.trim()
  return trimmed || fallbackLogoUrl({ name, shortName: shortNameFor(name), color })
}

function parseKickoff(event: TheSportsDBEvent): Date | null {
  const raw = (event.strTimestamp || [event.dateEvent, event.strTime || '00:00:00'].filter(Boolean).join('T')).trim()
  if (!raw) return null
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function statusFor(event: TheSportsDBEvent): FixtureStatus {
  const status = (event.strStatus ?? '').toUpperCase()
  if (['POST', 'PST', 'CANC'].includes(status)) return 'POSTPONED'
  if (['FT', 'AET', 'PEN'].includes(status)) return 'FINISHED'
  if (['1H', '2H', 'HT', 'ET', 'LIVE'].includes(status)) return 'LIVE'
  return 'SCHEDULED'
}

function score(value: string | null | undefined): number | null {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchEvents(leagueId: string): Promise<TheSportsDBEvent[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(API_KEY)}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error(`TheSportsDB league ${leagueId} returned ${response.status}`)
  const payload = (await response.json()) as { events?: TheSportsDBEvent[] | null }
  return Array.isArray(payload.events) ? payload.events : []
}

async function buildDataset(): Promise<TheSportsDBDataset> {
  const responses = await Promise.all(LEAGUE_IDS.map(id => fetchEvents(id).catch(() => [] as TheSportsDBEvent[])))
  const events = responses
    .flat()
    .filter(event => Boolean(event.idEvent && event.idHomeTeam && event.idAwayTeam && event.strHomeTeam && event.strAwayTeam))
    .filter(event => parseKickoff(event) !== null)
    .filter(event => ['SCHEDULED', 'LIVE', 'FINISHED'].includes(statusFor(event)))

  const teamMap = new Map<string, Team>()
  const competitionMap = new Map<string, Competition>()
  const sports: Sport[] = [{ id: 'football', name: 'Football', slug: 'football' }]
  const fixtures: Fixture[] = []

  for (const event of events) {
    const kickoffUtc = parseKickoff(event)
    if (!kickoffUtc) continue

    const homeName = event.strHomeTeam!.trim()
    const awayName = event.strAwayTeam!.trim()
    const homeColor = colorFor(homeName)
    const awayColor = colorFor(awayName)
    const home: Team = {
      id: `tsdb-team-${event.idHomeTeam}`,
      name: homeName,
      shortName: shortNameFor(homeName),
      color: homeColor,
      logoUrl: badgeUrl(event.strHomeTeamBadge, homeName, homeColor),
      providerId: event.idHomeTeam ?? null,
    }
    const away: Team = {
      id: `tsdb-team-${event.idAwayTeam}`,
      name: awayName,
      shortName: shortNameFor(awayName),
      color: awayColor,
      logoUrl: badgeUrl(event.strAwayTeamBadge, awayName, awayColor),
      providerId: event.idAwayTeam ?? null,
    }
    teamMap.set(home.id, home)
    teamMap.set(away.id, away)

    const leagueId = event.idLeague ?? 'unknown'
    const competitionId = `tsdb-league-${leagueId}`
    competitionMap.set(competitionId, {
      id: competitionId,
      name: (event.strLeague ?? 'Football').trim(),
      country: null,
      season: event.strSeason?.trim() ?? null,
      sportId: 'football',
      providerId: leagueId,
    })

    const status = statusFor(event)
    const elapsedMinutes = Math.max(1, Math.floor((Date.now() - kickoffUtc.getTime()) / 60_000))
    fixtures.push({
      id: `tsdb-event-${event.idEvent}`,
      providerId: event.idEvent ?? null,
      competitionId,
      sportId: 'football',
      homeTeamId: home.id,
      awayTeamId: away.id,
      kickoffUtc,
      status,
      homeScore: status === 'FINISHED' ? score(event.intHomeScore) : null,
      awayScore: status === 'FINISHED' ? score(event.intAwayScore) : null,
      liveMinute: status === 'LIVE' ? Math.min(120, elapsedMinutes) : null,
      liveHomeScore: status === 'LIVE' ? score(event.intHomeScore) : null,
      liveAwayScore: status === 'LIVE' ? score(event.intAwayScore) : null,
      venue: event.strVenue?.trim() || null,
      lastSyncedAt: new Date(),
    })
  }

  fixtures.sort((left, right) => left.kickoffUtc.getTime() - right.kickoffUtc.getTime())
  return {
    sports,
    competitions: [...competitionMap.values()],
    teams: [...teamMap.values()],
    fixtures,
  }
}

async function getDataset(): Promise<TheSportsDBDataset> {
  if (cached && cached.expiresAt > Date.now()) return cached.dataset
  if (pending) return pending
  pending = buildDataset()
  try {
    const dataset = await pending
    cached = { expiresAt: Date.now() + CACHE_MS, dataset }
    return dataset
  } finally {
    pending = null
  }
}

export class TheSportsDBProvider implements SportsDataProvider {
  name = 'thesportsdb'

  async getSports(): Promise<Sport[]> {
    return (await getDataset()).sports
  }

  async getCompetitions(): Promise<Competition[]> {
    return (await getDataset()).competitions
  }

  async getTeams(): Promise<Team[]> {
    return (await getDataset()).teams
  }

  async getFixtures(from: Date, to: Date): Promise<Fixture[]> {
    return (await getDataset()).fixtures.filter(
      fixture => fixture.kickoffUtc >= from && fixture.kickoffUtc <= to,
    )
  }

  async getFixture(fixtureId: string): Promise<Fixture | null> {
    return (await getDataset()).fixtures.find(fixture => fixture.id === fixtureId) ?? null
  }

  async getHealth(): Promise<ProviderHealth> {
    const dataset = await getDataset()
    if (dataset.fixtures.length === 0) {
      return {
        ok: false,
        mode: 'unavailable',
        message: 'TheSportsDB fixture feed returned no upcoming matches.',
      }
    }
    return {
      ok: true,
      mode: 'live',
      message: `${dataset.fixtures.length} real fixtures loaded from TheSportsDB.`,
    }
  }
}
