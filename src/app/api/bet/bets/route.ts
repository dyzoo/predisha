import { json } from '@/lib/api'
import { listTickets, placeBet } from '@/lib/bet/bets'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { placeBetSchema } from '@/lib/bet/validation'
import { getWalletView } from '@/lib/bet/wallet'
import { getBetMode } from '@/lib/bet/mode'

export async function GET() {
  try {
    const viewer = await requireViewer()
    const now = new Date()
    const [tickets, wallet] = await Promise.all([
      listTickets(viewer.userId, now),
      getWalletView(viewer.userId),
    ])
    return json({ tickets, wallet, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function POST(request: Request) {
  try {
    guardMutation(request, 'place-bet', 20, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, placeBetSchema)
    const ticket = await placeBet(viewer.userId, input)
    return json(
      {
        ticket,
        wallet: await getWalletView(viewer.userId),
        mode: await getBetMode(),
      },
      { status: 201 },
    )
  } catch (error) {
    return handleBetError(error)
  }
}
