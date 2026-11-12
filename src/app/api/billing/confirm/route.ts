import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getBillingProvider } from '@/lib/billing/provider'
import { applyBillingWebhookEvent } from '@/lib/billing/webhook'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const confirmSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }

  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in to confirm a payment.', 401)

  const limit = rateLimit(clientKey(request, 'billing-confirm'), 30, 60_000)
  if (!limit.ok) {
    return apiError('Too many confirmation attempts. Try again shortly.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) return apiError('Enter a valid order id.', 422)

  const provider = getBillingProvider()
  if (provider.name !== 'harakapay') {
    return apiError('Payment confirmation is not available for this provider.', 400)
  }

  const event = await prisma.billingEvent.findUnique({
    where: { providerEventId: parsed.data.orderId },
    select: { safeMetadata: true },
  })
  const metadata = (event?.safeMetadata ?? {}) as Record<string, unknown>
  if (!event || metadata.userId !== viewer.userId) {
    return apiError('Payment not found.', 404)
  }

  const confirmed = await provider.confirmCheckout(parsed.data.orderId)
  if (!confirmed) {
    return apiError('The payment provider could not confirm this order yet.', 502)
  }

  await applyBillingWebhookEvent(confirmed)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: viewer.userId },
    select: { status: true, planId: true, currentPeriodEnd: true },
  })

  return json({
    data: {
      status: subscription?.status ?? 'INACTIVE',
      planId: subscription?.planId ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      eventStatus: confirmed.status,
    },
  })
}
