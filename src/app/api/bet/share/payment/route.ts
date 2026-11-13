import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { startSlipPayment } from '@/lib/bet/slip-payments'
import { requireViewer } from '@/lib/bet/security'
import { shareCodeSchema } from '@/lib/bet/validation'

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer()
    const body = await request.json().catch(() => null)
    const parsed = shareCodeSchema.safeParse(body?.code)
    if (!parsed.success) {
      return json({ error: 'Enter a valid 6-character share code.' }, { status: 422 })
    }
    const result = await startSlipPayment({
      code: parsed.data,
      phone: typeof body?.phone === 'string' ? body.phone : '',
      userId: viewer.userId,
      now: new Date(),
    })
    return json({ entry: result.entry, slip: result.slip, mode: result.mode })
  } catch (error) {
    return handleBetError(error)
  }
}