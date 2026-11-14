import { json } from '@/lib/api'
import { createTrialForEntry } from '@/lib/bet/aviator-trial'
import { BetError, handleBetError } from '@/lib/bet/errors'
import { guardMutation } from '@/lib/bet/security'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'aviator-trial-start', 20, 60_000)
    const body = (await request.json().catch(() => null)) as { entryId?: unknown } | null
    const entryId = typeof body?.entryId === 'string' ? body.entryId : ''

    if (!entryId) {
      throw new BetError('A paid slip entry is required.', 422, 'ENTRY_REQUIRED')
    }

    const trial = await createTrialForEntry(entryId)
    return json({ trial })
  } catch (error) {
    return handleBetError(error)
  }
}
