import { json } from '@/lib/api'
import { requestTrialWithdrawal } from '@/lib/bet/aviator-trial'
import { BetError, handleBetError } from '@/lib/bet/errors'
import { guardMutation, requireViewer } from '@/lib/bet/security'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'aviator-trial-withdraw', 6, 10 * 60_000)
    const viewer = await requireViewer()
    const body = (await request.json().catch(() => null)) as { phone?: unknown } | null
    const phone = typeof body?.phone === 'string' ? body.phone : ''

    if (!phone.trim()) {
      throw new BetError('Enter the mobile-money number for your prize.', 422, 'PHONE_REQUIRED')
    }

    const result = await requestTrialWithdrawal(viewer.userId, phone)
    return json(result)
  } catch (error) {
    return handleBetError(error)
  }
}
