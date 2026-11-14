import { json } from '@/lib/api'
import { playTrial } from '@/lib/bet/aviator-trial'
import { handleBetError } from '@/lib/bet/errors'
import { guardMutation } from '@/lib/bet/security'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'aviator-trial-play', 8, 10 * 60_000)
    const result = await playTrial()
    return json(result)
  } catch (error) {
    return handleBetError(error)
  }
}
