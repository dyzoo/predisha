import { apiError, json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { prisma } from '@/lib/prisma'
import { FootballDataProvider } from '@/lib/sports/football-data'
import type { FixtureStatus } from '@/lib/sports/provider'
import type { RecentResultView } from '@/lib/sports/view-model'
import { toRecentResultView } from '@/lib/sports/view-model'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 50
const LOOKBACK_DAYS = 90

export async function GET(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const access = await getAdminAccess()
  if (access.status !== 'ok') return apiError('Admin access required.', 403)

  const url = new URL(request.url)
  const teamId = url.searchParams.get('teamId')?.trim() ?? ''
  if (!teamId) return apiError('teamId is required.', 422)

  const rawLimit = url.searchParams.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return apiError(`limit must be an integer between 1 and ${MAX_LIMIT}.`, 422)
  }

  let results: RecentResultView[] = []
  let source: 'provider' | 'stored' = 'stored'

  try {
    const providerFixtures = await new FootballDataProvider().getRecentResults(teamId, limit)
    const mapped = providerFixtures
      .map(fixture => toRecentResultView(fixture))
      .filter((item): item is RecentResultView => item !== null)
    if (mapped.length > 0) {
      results = mapped
      source = 'provider'
    }
  } catch {
    results = []
  }

  if (results.length === 0) {
    const from = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const storedRows = await prisma.fixture
      .findMany({
        where: {
          status: 'FINISHED',
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          kickoffUtc: { gte: from },
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { kickoffUtc: 'desc' },
        take: limit,
      })
      .catch(() => [])

    results = storedRows
      .map(row =>
        toRecentResultView({
          id: row.id,
          competitionId: row.competitionId,
          sportId: 'football',
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          homeTeam: {
            id: row.homeTeam.id,
            name: row.homeTeam.name,
            shortName: row.homeTeam.shortName,
            color: row.homeTeam.color,
            providerId: row.homeTeam.providerId,
            logoUrl: row.homeTeam.logoUrl,
          },
          awayTeam: {
            id: row.awayTeam.id,
            name: row.awayTeam.name,
            shortName: row.awayTeam.shortName,
            color: row.awayTeam.color,
            providerId: row.awayTeam.providerId,
            logoUrl: row.awayTeam.logoUrl,
          },
          kickoffUtc: row.kickoffUtc,
          status: row.status as FixtureStatus,
          homeScore: row.homeScore,
          awayScore: row.awayScore,
          halfTimeHomeScore: row.halfTimeHomeScore,
          halfTimeAwayScore: row.halfTimeAwayScore,
          venue: row.venue,
          referee: row.referee,
          lastSyncedAt: row.lastSyncedAt,
        }),
      )
      .filter((item): item is RecentResultView => item !== null)
  }

  return json({ ok: true, source, teamId, limit, results })
}
