import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { playGame } from '@/lib/bet/games'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { gamePlaySchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'game-play', 30, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, gamePlaySchema)
    const result = await playGame(viewer.userId, input)
    return json({ ...result, mode: await getBetMode() }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
