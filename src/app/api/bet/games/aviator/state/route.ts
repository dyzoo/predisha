import { json } from '@/lib/api'
import { getAviatorState } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'
import { getBetMode } from '@/lib/bet/mode'

export async function GET() {
  try {
    const viewer = await requireViewer()
    const state = await getAviatorState(viewer.userId, new Date())
    return json({ state, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}
