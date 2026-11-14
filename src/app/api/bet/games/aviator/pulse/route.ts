import { json } from '@/lib/api'
import { getAviatorPulse } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'

export async function GET() {
  try {
    return json(await getAviatorPulse())
  } catch (error) {
    return handleBetError(error)
  }
}
