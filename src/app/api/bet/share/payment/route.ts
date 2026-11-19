import { json } from '@/lib/api'
import { getViewer } from '@/lib/auth/session'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation } from '@/lib/bet/security'
import { startSlipPayment } from '@/lib/bet/slip-payments'
import { slipPaymentSchema } from '@/lib/bet/validation'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'share-slip-payment', 12, 60_000)
    const viewer = await getViewer()
    const body = await request.json().catch(() => null)
    const parsed = slipPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message ?? 'Enter valid payment details.' }, { status: 422 })
    }
    const result = await startSlipPayment({
      code: parsed.data.code,
      phone: parsed.data.phone ?? '',
      userId: viewer.userId,
      source: parsed.data.source,
      now: new Date(),
    })
    return json({ entry: result.entry, slip: result.slip, mode: result.mode })
  } catch (error) {
    return handleBetError(error)
  }
}