import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { startMines } from '@/lib/bet/games'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { minesStartSchema } from '@/lib/bet/validation'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'mines-start', 20, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, minesStartSchema)
    const result = await startMines(viewer.userId, input)
    return json({ ...result, sandbox: true }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
