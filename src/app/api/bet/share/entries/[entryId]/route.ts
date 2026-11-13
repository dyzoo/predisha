import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { refreshSlipPaymentEntry } from '@/lib/bet/slip-payments'

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const { entryId } = await params
    const entry = await refreshSlipPaymentEntry(entryId)
    return json({ entry })
  } catch (error) {
    return handleBetError(error)
  }
}