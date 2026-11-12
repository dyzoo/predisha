import { json } from '@/lib/api'
import { getAviatorState } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'

export async function GET() {
  try {
    const viewer = await requireViewer()
    const state = await getAviatorState(viewer.userId, new Date())
    return json({ state, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
