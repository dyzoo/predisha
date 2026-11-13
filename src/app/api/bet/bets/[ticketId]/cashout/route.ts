import { json } from '@/lib/api'
import { cashoutTicket } from '@/lib/bet/bets'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, requireViewer } from '@/lib/bet/security'
import { getWalletView } from '@/lib/bet/wallet'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    guardMutation(request, 'cashout', 20, 60_000)
    const viewer = await requireViewer()
    const { ticketId } = await params
    const ticket = await cashoutTicket(viewer.userId, ticketId)
    return json({
      ticket,
      wallet: await getWalletView(viewer.userId),
      mode: await getBetMode(),
    })
  } catch (error) {
    return handleBetError(error)
  }
}
