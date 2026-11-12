import { json } from '@/lib/api'
import { cashoutAviator } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { aviatorCashoutSchema } from '@/lib/bet/validation'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'aviator-cashout', 60, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, aviatorCashoutSchema)
    const result = await cashoutAviator(viewer.userId, input.betId, new Date())
    return json({ ...result, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
