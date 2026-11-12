import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { claimPromo } from '@/lib/bet/promos'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { promoClaimSchema } from '@/lib/bet/validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ promoId: string }> },
) {
  try {
    guardMutation(request, 'promo-claim', 10, 60_000)
    const viewer = await requireViewer()
    const { promoId } = await params
    const input = await readJson(request, promoClaimSchema)
    if (input.promoId !== promoId) {
      return json({ error: 'Promo mismatch.' }, { status: 422 })
    }
    const result = await claimPromo(viewer.userId, promoId)
    return json({ ...result, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
