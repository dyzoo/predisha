import { apiError, json } from '@/lib/api'
import { getBetCatalog } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { toAdminSlipView } from '@/lib/bet/slips'
import { prisma } from '@/lib/prisma'
import { shareCodeSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'
import { getMinStakeMinor } from '@/lib/bet/stake-settings'
import type { TicketSelection } from '@/lib/bet/types'

function hasActiveLiveOverride(selection: TicketSelection): boolean {
  return (
    selection.result === 'PENDING' &&
    !selection.finalScore &&
    (selection.liveScore != null || selection.liveMinute != null)
  )
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