import { after } from 'next/server'
import { apiError, json } from '@/lib/api'
import { applyDepositPaymentEvent } from '@/lib/bet/deposits'
import { applySlipPaymentEvent } from '@/lib/bet/slip-payments'
import {
  parseSettloWebhookEvent,
  SETTLO_PROVIDER_NAME,
  verifySettloWebhook,
  verifySettloWebhookSignature,
  type SettloWebhookEvent,
} from '@/lib/billing/settlopay'
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

async function processEvent(
  rawBody: string,
  signature: string | null,
  eventId: string | null,
  parsed: SettloWebhookEvent,
): Promise<void> {
  const event = (await verifySettloWebhook(rawBody, signature, eventId).catch(() => null)) ?? parsed
  const slipPayment = await applySlipPaymentEvent(event)
  if (slipPayment.handled) return

  const deposit = await applyDepositPaymentEvent(event)
  if (deposit.handled) return

  await applyBillingWebhookEvent(event)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params
  if (providerId !== SETTLO_PROVIDER_NAME) {
    return apiError('Unknown billing provider.', 404)
  }

  const eventId = request.headers.get('settlo-event-id')
  const signature = request.headers.get('settlo-signature')
  const rawBody = await request.text()
  if (!verifySettloWebhookSignature(rawBody, signature)) {
    return apiError('Invalid Settlo Pay webhook signature.', 400)
  }

  const parsed = parseSettloWebhookEvent(rawBody, eventId)
  if (!parsed) return json({ received: true })

  if (parsed.providerEventId && handledEventIds.has(parsed.providerEventId)) {
    return json({ received: true, duplicate: true })
  }
  if (parsed.providerEventId) rememberEvent(parsed.providerEventId)

  after(async () => {
    try {
      await processEvent(rawBody, signature, eventId, parsed)
    } catch (error) {
      console.error('[webhook] processing failed', error instanceof Error ? error.message : String(error))
    }
  })

  return json({ received: true })
}
