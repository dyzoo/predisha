import { apiError, json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { shareCodeSchema } from '@/lib/bet/validation'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) return apiError('Enter a valid 6-character share code.', 422)
    const share = await loadShareCode(parsed.data, new Date())
    return json({ share, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
