import { apiError, json } from '@/lib/api'
import { getBetCatalog, getFixtureResults, type FixtureResult } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { liveMatchesForSelections } from '@/lib/bet/in-play'
import { reconcileAdminSlipSelections } from '@/lib/bet/slip-reconciliation'
import { toAdminSlipView } from '@/lib/bet/slips'
import { prisma } from '@/lib/prisma'
import { shareCodeSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'
import { getMinStakeMinor } from '@/lib/bet/stake-settings'
import { isProviderFixtureId, type TicketSelection } from '@/lib/bet/types'

interface SharedResolvedResult extends FixtureResult {
  source: 'admin' | 'provider'
}

function finishedResult(value: {
  status: FixtureResult['status']
  homeScore?: number | null
  awayScore?: number | null
  halfTimeHomeScore?: number | null
  halfTimeAwayScore?: number | null
}): FixtureResult | null {
  if (
    value.status !== 'FINISHED' ||
    typeof value.homeScore !== 'number' ||
    typeof value.awayScore !== 'number'
  ) {
    return null
  }
  return {
    status: value.status,
    homeScore: value.homeScore,
    awayScore: value.awayScore,
    halfTimeHomeScore: value.halfTimeHomeScore ?? null,
    halfTimeAwayScore: value.halfTimeAwayScore ?? null,
  }
}

async function resolveSharedResults(
  selections: TicketSelection[],
  catalog: Awaited<ReturnType<typeof getBetCatalog>>,
  now: Date,
): Promise<Record<string, SharedResolvedResult>> {
  const storedResults = await getFixtureResults(now)
  const eventsById = new Map(catalog.events.map(event => [event.id, event]))
  const results: Record<string, SharedResolvedResult> = {}

  for (const selection of selections) {
    const manual = selection.finalScore
    if (manual && typeof manual.home === 'number' && typeof manual.away === 'number') {
      results[selection.fixtureId] = {
        status: 'FINISHED',
        homeScore: manual.home,
        awayScore: manual.away,
        halfTimeHomeScore: null,
        halfTimeAwayScore: null,
        source: 'admin',
      }
      continue
    }

    if (!isProviderFixtureId(selection.fixtureId)) continue

    const event = eventsById.get(selection.fixtureId)
    const storedResult = finishedResult(
      storedResults.get(selection.fixtureId) ?? { status: 'SCHEDULED' as const },
    )
    const catalogResult = finishedResult({
      status: event?.effectiveStatus ?? 'SCHEDULED',
      homeScore: event?.score?.home ?? null,
      awayScore: event?.score?.away ?? null,
    })
    const resolved = storedResult ?? catalogResult
    if (resolved) {
      results[selection.fixtureId] = { ...resolved, source: 'provider' }
    }
  }

  return results
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const now = new Date()
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) return apiError('Enter a valid 6-character share code.', 422)
    const catalog = await getBetCatalog(now)
    const upcomingGames = catalog.events
      .filter(event => event.effectiveStatus === 'SCHEDULED')
      .slice(0, 9)
    const slip = await prisma.adminBetSlip.findUnique({ where: { code: parsed.data } })
    if (slip) {
      const reconciled = await reconcileAdminSlipSelections(slip, now)
      const view = toAdminSlipView(reconciled, now)
      return json({
        share: { code: view.code, selections: view.selections, expiresAt: view.autoFreezeAt, stale: false },
        slip: { ...view, frozenReason: null },
        results: await resolveSharedResults(view.selections, catalog, now),
        live: liveMatchesForSelections(view.selections, view.clock, catalog.events, now),
        upcomingGames,
        mode: await getBetMode(),
        minStakeMinor: await getMinStakeMinor(),
      })
    }
    const share = await loadShareCode(parsed.data, now)
    return json({
      share,
      slip: null,
      results: await resolveSharedResults(share.selections, catalog, now),
      live: liveMatchesForSelections(share.selections, null, catalog.events, now),
      upcomingGames,
      mode: await getBetMode(),
      minStakeMinor: await getMinStakeMinor(),
    })
  } catch (error) {
    return handleBetError(error)
  }
}