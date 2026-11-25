import { connection } from 'next/server'
import { apiError, json } from '@/lib/api'
import { applyDepositPaymentEvent } from '@/lib/bet/deposits'
import { applySlipPaymentEvent } from '@/lib/bet/slip-payments'
import { SETTLO_PROVIDER_NAME, verifySettloWebhook } from '@/lib/billing/settlopay'
import { applyBillingWebhookEvent } from '@/lib/billing/webhook'

const handledEventIds = new Set<string>()
const MAX_HANDLED_EVENT_IDS = 1_000

function rememberEvent(eventId: string): void {
  handledEventIds.add(eventId)
  if (handledEventIds.size > MAX_HANDLED_EVENT_IDS) {
    const oldest = handledEventIds.values().next().value
    if (oldest) handledEventIds.delete(oldest)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  await connection()

  const { provider: providerId } = await params
  if (providerId !== SETTLO_PROVIDER_NAME) {
    return apiError('Unknown billing provider.', 404)
  }

  const eventId = request.headers.get('settlo-event-id')
  const rawBody = await request.text()
  const event = await verifySettloWebhook(rawBody, request.headers.get('settlo-signature'), eventId)
  if (!event) {
    return apiError('Invalid Settlo Pay webhook signature.', 401)
  }

  if (event.providerEventId && handledEventIds.has(event.providerEventId)) {
    return json({ data: { received: true, handled: true, duplicate: true } })
  }

  const slipPayment = await applySlipPaymentEvent(event)
  if (slipPayment.handled) {
    if (event.providerEventId) rememberEvent(event.providerEventId)
    return json({ data: { received: true, handled: true, kind: 'bet-slip' } })
  }

  const deposit = await applyDepositPaymentEvent(event)
  if (deposit.handled) {
    if (event.providerEventId) rememberEvent(event.providerEventId)
    return json({ data: { received: true, handled: true, kind: 'wallet-deposit' } })
  }

  const result = await applyBillingWebhookEvent(event)
  if (result.handled && event.providerEventId) rememberEvent(event.providerEventId)
  return json({ data: { received: true, handled: result.handled } })
}
