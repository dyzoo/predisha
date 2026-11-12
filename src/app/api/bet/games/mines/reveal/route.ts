import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { revealMines } from '@/lib/bet/games'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { minesRevealSchema } from '@/lib/bet/validation'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'mines-reveal', 120, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, minesRevealSchema)
    const result = await revealMines(viewer.userId, input)
    return json({ ...result, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
