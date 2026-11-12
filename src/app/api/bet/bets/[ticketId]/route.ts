import { apiError, json } from '@/lib/api'
import { getTicket } from '@/lib/bet/bets'
import { handleBetError } from '@/lib/bet/errors'
import { requireViewer } from '@/lib/bet/security'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const viewer = await requireViewer()
    const { ticketId } = await params
    const ticket = await getTicket(viewer.userId, ticketId)
    if (!ticket) return apiError('Ticket not found.', 404)
    return json({ ticket, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
