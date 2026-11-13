import { json } from '@/lib/api'
import { refreshWalletDeposit } from '@/lib/bet/deposits'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'
import { getWalletView } from '@/lib/bet/wallet'

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer()
    const orderId = new URL(request.url).searchParams.get('orderId')?.trim()
    if (!orderId) {
      return json({ error: 'orderId is required.' }, { status: 422 })
    }
    const order = await refreshWalletDeposit(viewer.userId, orderId)
    return json({ order, wallet: await getWalletView(viewer.userId) })
  } catch (error) {
    return handleBetError(error)
  }
}
