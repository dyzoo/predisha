import { apiError, json } from '@/lib/api'
import { getBetCatalog } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { toAdminSlipView } from '@/lib/bet/slips'
import { prisma } from '@/lib/prisma'
import { shareCodeSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'
import type { TicketSelection } from '@/lib/bet/types'

async function liveMatchesFor(selections: TicketSelection[], now: Date) {
  if (selections.length === 0) return []
  const fixtureIds = new Set(selections.map(selection => selection.fixtureId))
  const catalog = await getBetCatalog(now)
  return catalog.events
    .filter(event => fixtureIds.has(event.id) && event.live)
    .map(event => ({
      fixtureId: event.id,
      competition: event.competition,
      kickoffIso: event.kickoffIso,
      minute: event.minute,
      score: event.score,
      home: event.home,
      away: event.away,
    }))
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
        slip: view,
        live: await liveMatchesFor(view.selections, now),
        liveGames,
        upcomingGames,
        mode: await getBetMode(),
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
    })
  } catch (error) {
    return handleBetError(error)
  }
}