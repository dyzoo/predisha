const STANDINGS_CACHE_MS = 15 * 60 * 1000

export interface StandingRowView {
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
  form: string[]
  logoUrl: string | null
}

export interface CompetitionStandingsView {
  competitionId: string
  rows: StandingRowView[]
  source: 'football-data' | 'unavailable'
  retrievedAt: string | null
  message: string
}

interface CachedStandings {
  at: number
  promise: Promise<CompetitionStandingsView>
}

const cache = new Map<string, CachedStandings>()

function unavailable(competitionId: string, message: string): CompetitionStandingsView {
  return {
    competitionId,
    rows: [],
    source: 'unavailable',
    retrievedAt: null,
    message,
  }
}

async function fetchFootballDataStandings(
  competitionId: string,
  providerId: string | null | undefined,
): Promise<CompetitionStandingsView> {
  const configured =
    process.env.SPORTS_DATA_PROVIDER?.toLowerCase() === 'football-data' &&
    Boolean(process.env.FOOTBALL_DATA_API_TOKEN)
  const remoteId = providerId ?? competitionId

  if (!configured || !/^\d+$/.test(remoteId)) {
    return unavailable(
      competitionId,
      'League standings are not available from the current data provider for this competition.',
    )
  }

  const { FootballDataProvider } = await import('./football-data')
  const provider = new FootballDataProvider()
  const rows = await provider.getStandings(remoteId)

  return {
    competitionId,
    rows: rows.map(row => ({
      ...row,
      form: row.form ?? [],
      logoUrl: row.logoUrl ?? null,
    })),
    source: 'football-data',
    retrievedAt: new Date().toISOString(),
    message: 'Standings supplied by football-data.org.',
  }
}

export async function getCompetitionStandings(
  competitionId: string,
  providerId?: string | null,
): Promise<CompetitionStandingsView> {
  const key = providerId ?? competitionId
  const cached = cache.get(key)
  const now = Date.now()

  if (cached && now - cached.at < STANDINGS_CACHE_MS) {
    return cached.promise
  }

  const promise = fetchFootballDataStandings(competitionId, providerId)
    .then(result => result)
    .catch(() =>
      unavailable(
        competitionId,
        'League standings could not be loaded right now. Fixture analysis remains available.',
      ),
    )

  cache.set(key, { at: now, promise })
  return promise
}
