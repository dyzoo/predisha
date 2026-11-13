import { json } from '@/lib/api'
import { placeAviatorBet } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { aviatorBetSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'aviator-bet', 30, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, aviatorBetSchema)
    const result = await placeAviatorBet(viewer.userId, input, new Date())
    return json({ ...result, mode: await getBetMode() }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
