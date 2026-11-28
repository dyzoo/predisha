import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { canClaimWinnerSlip } from '@/lib/auth/entitlements'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, requireViewer } from '@/lib/bet/security'
import { assignAdminSlipEntryWin } from '@/lib/bet/winners'
import { prisma } from '@/lib/prisma'

const claimSchema = z.object({
  entryId: z.string().min(1).max(80).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    guardMutation(request, 'share-winner')
    const viewer = await requireViewer()
    if (!canClaimWinnerSlip(viewer)) {
      return apiError('Special bet tools are not enabled for this account.', 403)
    }

    const { code } = await params
    const normalized = code.trim().toUpperCase()
    const slip = await prisma.adminBetSlip.findUnique({ where: { code: normalized } })
    if (!slip) return apiError('That slip code does not exist.', 404)

    let payload: z.infer<typeof claimSchema>
    try {
      payload = claimSchema.parse(await request.json().catch(() => ({})))
    } catch {
      return apiError('Invalid request body.', 400)
    }

    const entry = await prisma.adminBetEntry.findFirst({
      where: {
        slipId: slip.id,
        userId: viewer.userId,
        status: 'PAID',
        ...(payload.entryId ? { id: payload.entryId } : {}),
      },
      orderBy: { paidAt: 'desc' },
    })
    if (!entry) {
      return apiError('You need a paid entry on this slip before claiming a win.', 409)
    }

    const winner = await assignAdminSlipEntryWin({
      entryId: entry.id,
      createdBy: viewer.userId,
    })

    await prisma.adminAuditLog.create({
      data: {
        actorId: viewer.userId,
        action: 'admin.winner.self-assign',
        target: winner.code,
        metadata: {
          slipCode: slip.code,
          entryId: entry.id,
          userId: viewer.userId,
          netPayoutMinor: winner.netPayoutMinor,
        },
      },
    })

    return json({
      winner: {
        code: winner.code,
        netPayoutMinor: winner.netPayoutMinor,
        grossPayoutMinor: winner.grossPayoutMinor,
        vatMinor: winner.vatMinor,
        ticketCode: winner.ticketCode,
      },
      shareUrl: `/bet/winner/${winner.code}`,
    })
  } catch (error) {
    return handleBetError(error)
  }
}
