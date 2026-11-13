import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { cashoutMines } from '@/lib/bet/games'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { minesCashoutSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'mines-cashout', 30, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, minesCashoutSchema)
    const result = await cashoutMines(viewer.userId, input, new Date())
    return json({ ...result, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}
