import { connection } from 'next/server'
import { apiError, json } from '@/lib/api'
import { applyDepositPaymentEvent } from '@/lib/bet/deposits'
import { applySlipPaymentEvent } from '@/lib/bet/slip-payments'
import { getBillingProvider } from '@/lib/billing/provider'
import { applyBillingWebhookEvent } from '@/lib/billing/webhook'
import { SETTLO_PROVIDER_NAME } from '@/lib/billing/settlo'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  await connection()

  const { provider: providerId } = await params
  const provider = getBillingProvider()
  if (providerId !== provider.name) {
    return apiError('Unknown billing provider.', 404)
  }

  const rawBody = await request.text()
  const signature = request.headers.get('settlo-signature')
  const eventId = request.headers.get('settlo-event-id')
  const event = await provider.verifyWebhook(rawBody, signature, eventId)
  if (!event) {
    return apiError('Invalid SettloPay webhook signature.', 400)
  }

  const dedupeKey = event.eventId ? `settlo_event:${event.eventId}` : null
  if (dedupeKey) {
    const seen = await prisma.billingEvent.findUnique({ where: { providerEventId: dedupeKey } }).catch(() => null)
    if (seen) {
      return json({ data: { received: true, handled: true, kind: 'duplicate' } })
    }
  }

  const slipPayment = await applySlipPaymentEvent(event)
  if (slipPayment.handled) {
    await recordWebhookEvent(dedupeKey, event)
    return json({ data: { received: true, handled: true, kind: 'bet-slip' } })
  }

  const deposit = await applyDepositPaymentEvent(event)
  if (deposit.handled) {
    await recordWebhookEvent(dedupeKey, event)
    return json({ data: { received: true, handled: true, kind: 'wallet-deposit' } })
  }

  const result = await applyBillingWebhookEvent(event)
  await recordWebhookEvent(dedupeKey, event)
  return json({ data: { received: true, handled: result.handled, kind: 'subscription' } })
}

async function recordWebhookEvent(
  dedupeKey: string | null,
  event: { provider: string; type: string; orderId: string | null; status: string | null },
) {
  if (!dedupeKey) return
  await prisma.billingEvent
    .create({
      data: {
        providerEventId: dedupeKey,
        type: event.type,
        processed: true,
        processingState: 'SUCCEEDED',
        processedAt: new Date(),
        safeMetadata: {
          provider: SETTLO_PROVIDER_NAME,
          orderId: event.orderId,
          status: event.status,
        },
      },
    })
    .catch(() => undefined)
}
