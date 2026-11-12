import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'
import { getWalletView } from '@/lib/bet/wallet'

export async function GET() {
  try {
    const viewer = await requireViewer()
    const wallet = await getWalletView(viewer.userId)
    return json({ wallet })
  } catch (error) {
    return handleBetError(error)
  }
}
