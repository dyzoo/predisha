import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { apiError, json } from '@/lib/api'
import { cashoutTicketById } from '@/lib/bet/bets'
import { getBetCatalog } from '@/lib/bet/catalog'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation } from '@/lib/bet/security'
import { toAdminSlipView } from '@/lib/bet/slips'
import { isProviderFixtureId, type BetTicketView } from '@/lib/bet/types'
import { prisma } from '@/lib/prisma'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    guardMutation(request, 'share-force-cashout')
    const viewer = await getViewer()
    if (!viewer.userId) return apiError('Sign in to continue.', 401)
    if (!canViewAdmin(viewer)) {
      return apiError('Only administrators can force cash out a slip.', 403)
    }

    const { code } = await params
    const normalized = code.trim().toUpperCase()
    const slip = await prisma.adminBetSlip.findUnique({ where: { code: normalized } })
    if (!slip) return apiError('That slip does not exist.', 404)

    const now = new Date()
    const view = toAdminSlipView(slip, now)
    let ongoing = view.inPlay || Boolean(view.matchClock?.live)
    if (!ongoing) {
      const providerIds = [
        ...new Set(
          view.selections
            .filter(selection => isProviderFixtureId(selection.fixtureId))
            .map(selection => selection.fixtureId),
        ),
      ]
      if (providerIds.length > 0) {
        const catalog = await getBetCatalog(now)
        const providerIdSet = new Set(providerIds)
        ongoing = catalog.events.some(event => providerIdSet.has(event.id) && event.live)
      }
    }
    if (!ongoing) {
      return apiError('This slip has no ongoing games.', 409, { code: 'NO_ONGOING_GAMES' })
    }

    const entries = await prisma.adminBetEntry.findMany({
      where: {
        slipId: slip.id,
        status: 'PAID',
        ticketId: { not: null },
      },
      select: { ticketId: true },
    })
    if (entries.length === 0) {
      return apiError('No paid tickets are available to cash out.', 409, { code: 'NO_PAID_TICKETS' })
    }

    const tickets: BetTicketView[] = []
    const errors: string[] = []
    for (const entry of entries) {
      if (!entry.ticketId) continue
      try {
        tickets.push(await cashoutTicketById(entry.ticketId, now))
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Could not cash out a ticket.')
      }
    }
    if (tickets.length === 0) {
      return apiError(errors[0] ?? 'No tickets could be cashed out.', 409, { code: 'CASHOUT_FAILED' })
    }

    const totalMinor = tickets.reduce(
      (sum, ticket) => sum + (ticket.cashoutMinor ?? ticket.payoutMinor ?? 0),
      0,
    )
    await prisma.adminAuditLog.create({
      data: {
        actorId: viewer.userId,
        action: 'admin.slip.force-cashout',
        target: slip.code,
        ipAddress: requestIp(request),
        metadata: {
          attempted: entries.length,
          cashedOut: tickets.length,
          totalMinor,
          errors,
        },
      },
    })

    return json({ count: tickets.length, totalMinor, tickets, errors })
  } catch (error) {
    return handleBetError(error)
  }
}
