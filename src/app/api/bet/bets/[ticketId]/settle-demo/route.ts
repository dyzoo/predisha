import { json } from '@/lib/api'
import { resolveDemoTicket } from '@/lib/bet/bets'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, requireViewer } from '@/lib/bet/security'
import { getWalletView } from '@/lib/bet/wallet'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    guardMutation(request, 'settle-demo', 20, 60_000)
    const viewer = await requireViewer()
    const { ticketId } = await params
    const ticket = await resolveDemoTicket(viewer.userId, ticketId)
    return json({
      ticket,
      wallet: await getWalletView(viewer.userId),
      mode: await getBetMode(),
      note: 'Demo fixtures were resolved with the demo resolver.',
    })
  } catch (error) {
    return handleBetError(error)
  }
}
