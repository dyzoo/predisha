import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { createShareCode } from '@/lib/bet/share'
import { shareCreateSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'share-create', 10, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, shareCreateSchema)
    const share = await createShareCode(viewer.userId, input)
    return json({ share, mode: await getBetMode() }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
