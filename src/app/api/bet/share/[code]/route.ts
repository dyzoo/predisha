import { apiError, json } from '@/lib/api'
import { getBetCatalog, getFixtureResults, type FixtureResult } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { toAdminSlipView } from '@/lib/bet/slips'
import { prisma } from '@/lib/prisma'
import { shareCodeSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'
import { getMinStakeMinor } from '@/lib/bet/stake-settings'
import { isProviderFixtureId, type TicketSelection } from '@/lib/bet/types'
import { refreshFootballDataFixtures } from '@/lib/sports/sync'

function hasActiveLiveOverride(selection: TicketSelection): boolean {
  return (
    selection.result === 'PENDING' &&
    !selection.finalScore &&
    (selection.liveScore != null || selection.liveMinute != null)
  )
}

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
  const providerIds = [
    ...new Set(
      selections
        .filter(selection => !selection.finalScore && isProviderFixtureId(selection.fixtureId))
        .map(selection => selection.fixtureId),
    ),
  ].slice(0, 10)

  const refreshed = providerIds.length > 0
    ? await refreshFootballDataFixtures(providerIds).catch(() => [])
    : []
  const refreshedById = new Map(refreshed.map(fixture => [fixture.id, fixture]))
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
    const refreshedResult = finishedResult(refreshedById.get(selection.fixtureId) ?? {
      status: 'SCHEDULED' as const,
    })
    const storedResult = finishedResult(
      storedResults.get(selection.fixtureId) ?? { status: 'SCHEDULED' as const },
    )
    const catalogResult = finishedResult({
      status: event?.effectiveStatus ?? 'SCHEDULED',
      homeScore: event?.score?.home ?? null,
      awayScore: event?.score?.away ?? null,
    })
    const resolved = refreshedResult ?? storedResult ?? catalogResult
    if (resolved) {
      results[selection.fixtureId] = { ...resolved, source: 'provider' }
    }
  }

  return results
}

async function liveMatchesFor(selections: TicketSelection[], now: Date) {
  if (selections.length === 0) return []
  const selectionById = new Map(selections.map(selection => [selection.fixtureId, selection]))
  const fixtureIds = new Set(selectionById.keys())
  const catalog = await getBetCatalog(now)
  const catalogRows = catalog.events
    .filter(event => fixtureIds.has(event.id))
    .flatMap(event => {
      const selection = selectionById.get(event.id)
      const override = selection && hasActiveLiveOverride(selection)
      const minute = override ? (selection.liveMinute ?? event.minute) : event.minute
      const score = override ? (selection.liveScore ?? event.score) : event.score
      const live = event.live || Boolean(override)
      if (!live) return []
      return [
        {
          fixtureId: event.id,
          competition: event.competition,
          kickoffIso: event.kickoffIso,
          minute,
          score,
          home: event.home,
          away: event.away,
        },
      ]
    })
  const covered = new Set(catalogRows.map(row => row.fixtureId))
  const overrideRows = selections
    .filter(
      selection => !covered.has(selection.fixtureId) && hasActiveLiveOverride(selection),
    )
    .map(selection => {
      const [homeName = 'Home', awayName = 'Away'] = selection.fixtureLabel.split(/\s+vs\.?\s+/i)
      return {
        fixtureId: selection.fixtureId,
        competition: selection.competition,
        kickoffIso: selection.kickoffIso,
        minute: selection.liveMinute ?? null,
        score: selection.liveScore ?? null,
        home: {
          name: homeName,
          short: homeName.slice(0, 3).toUpperCase(),
          color: '#10b981',
        },
        away: {
          name: awayName,
          short: awayName.slice(0, 3).toUpperCase(),
          color: '#ef4444',
        },
      }
    })
  return [...catalogRows, ...overrideRows]
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
    const liveGames = catalog.events.filter(event => event.live)
    const upcomingGames = catalog.events
      .filter(event => event.effectiveStatus === 'SCHEDULED')
      .slice(0, 9)
    const slip = await prisma.adminBetSlip.findUnique({ where: { code: parsed.data } })
    if (slip) {
      const view = toAdminSlipView(slip, now)
      return json({
        share: { code: view.code, selections: view.selections, expiresAt: view.autoFreezeAt, stale: false },
        slip: { ...view, frozenReason: null },
        results: await resolveSharedResults(view.selections, catalog, now),
        live: await liveMatchesFor(view.selections, now),
        liveGames,
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
      live: await liveMatchesFor(share.selections, now),
      liveGames,
      upcomingGames,
      mode: await getBetMode(),
      minStakeMinor: await getMinStakeMinor(),
    })
  } catch (error) {
    return handleBetError(error)
  }
}