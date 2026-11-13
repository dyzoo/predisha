import { apiError, json } from '@/lib/api'
import { getTicket } from '@/lib/bet/bets'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'
import { getBetMode } from '@/lib/bet/mode'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const viewer = await requireViewer()
    const { ticketId } = await params
    const ticket = await getTicket(viewer.userId, ticketId)
    if (!ticket) return apiError('Ticket not found.', 404)
    return json({ ticket, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}
