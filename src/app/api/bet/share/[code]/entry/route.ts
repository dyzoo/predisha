import { json } from '@/lib/api'
import { getViewer } from '@/lib/auth/session'
import { handleBetError } from '@/lib/bet/errors'
import { maskPhone } from '@/lib/bet/slips'
import { shareCodeSchema } from '@/lib/bet/validation'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) return json({ entry: null })

    const viewer = await getViewer()
    if (!viewer.userId) return json({ entry: null })

    const slip = await prisma.adminBetSlip.findUnique({
      where: { code: parsed.data },
      select: { id: true },
    })
    if (!slip) return json({ entry: null })

    const entry = await prisma.adminBetEntry.findFirst({
      where: {
        slipId: slip.id,
        userId: viewer.userId,
        status: 'PAID',
        ticketId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!entry?.ticketId) return json({ entry: null })

    const ticket = await prisma.betTicket.findUnique({
      where: { id: entry.ticketId },
      select: { code: true },
    })

    return json({
      entry: {
        id: entry.id,
        status: entry.status,
        phoneMasked: maskPhone(entry.phone),
        stakeMinor: entry.stakeMinor,
        providerOrderId: entry.providerOrderId,
        ticketId: entry.ticketId,
        ticketCode: ticket?.code ?? null,
        paidAt: entry.paidAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        message: 'Your stake is on this slip.',
      },
    })
  } catch (error) {
    return handleBetError(error)
  }
}
