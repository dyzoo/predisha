import { apiError, json, parseIsoDate, parsePositiveInt } from '@/lib/api'
import { getViewer } from '@/lib/auth/session'
import { canViewPremium } from '@/lib/auth/entitlements'
import { getMatchAnalyses } from '@/lib/sports/service'
import { serializeMatchView } from '@/lib/sports/serialize'
import { toMatchView } from '@/lib/sports/view-model'
import type { FixtureStatus } from '@/lib/sports/provider'

const STATUSES: FixtureStatus[] = [
  'SCHEDULED',
  'LIVE',
  'FINISHED',
  'POSTPONED',
  'CANCELLED',
  'ABANDONED',
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const viewer = await getViewer()
  const now = new Date()
  const from = parseIsoDate(url.searchParams.get('from')) ?? new Date(now.getTime() - 2 * 86_400_000)
  const to = parseIsoDate(url.searchParams.get('to')) ?? new Date(now.getTime() + 30 * 86_400_000)
  if (from.getTime() > to.getTime()) {
    return apiError('`from` must be before `to`.', 422)
  }

  const statusValue = url.searchParams.get('status')
  const status = statusValue ? statusValue.toUpperCase() : null
  if (status && !STATUSES.includes(status as FixtureStatus)) {
    return apiError('Unknown fixture status.', 422, { allowed: STATUSES })
  }

  const competition = url.searchParams.get('competition')
  const sport = url.searchParams.get('sport')
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 24, 50)

  const { analyses, dataset } = await getMatchAnalyses(now)
  const filtered = analyses
    .filter(analysis => {
      const kickoff = analysis.fixture.kickoffUtc.getTime()
      if (kickoff < from.getTime() || kickoff > to.getTime()) return false
      if (competition && analysis.competition.id !== competition) return false
      if (sport && analysis.sport.id !== sport && analysis.sport.slug !== sport) return false
      if (status && analysis.fixture.status !== status) return false
      return true
    })
    .sort((a, b) => a.fixture.kickoffUtc.getTime() - b.fixture.kickoffUtc.getTime())

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const data = filtered
    .slice((safePage - 1) * pageSize, safePage * pageSize)
    // Explanation is a premium field; list responses never include it.
    .map(analysis => serializeMatchView(toMatchView(analysis), { includeExplanation: false }))

  return json({
    data,
    meta: {
      total: filtered.length,
      page: safePage,
      pageSize,
      pageCount,
      from: from.toISOString(),
      to: to.toISOString(),
      demo: dataset.isDemo,
      provider: dataset.health.mode,
      premium: canViewPremium(viewer),
    },
  })
}
