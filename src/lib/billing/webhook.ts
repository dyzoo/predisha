import { prisma } from '@/lib/prisma'
import type { HarakaPayWebhookEvent } from '@/lib/billing/harakapay'

const DAY_MS = 24 * 60 * 60 * 1000

const SUCCESS_STATUSES = new Set(['completed', 'success', 'succeeded', 'paid', 'confirmed'])
const FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'expired'])

export async function applyBillingWebhookEvent(
  event: HarakaPayWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }
  const status = (event.status ?? '').toLowerCase()

  const existing = await prisma.billingEvent.findUnique({
    where: { providerEventId: event.orderId },
  })
  if (!existing) return { handled: false }
  if (existing.processed && existing.type === event.type) return { handled: true }

  const metadata = (existing.safeMetadata ?? {}) as Record<string, string>
  const userId = metadata.userId ?? null
  const planId = metadata.planId ?? null

  const processedAt = new Date()
  const nextMetadata = {
    ...metadata,
    status: event.status,
    updatedAt: processedAt.toISOString(),
  }

  await prisma.billingEvent.upsert({
    where: { providerEventId: event.orderId },
    update: {
      type: event.type,
      processed: true,
      processingState: 'SUCCEEDED',
      processedAt,
      safeMetadata: nextMetadata,
    },
    create: {
      providerEventId: event.orderId,
      type: event.type,
      processed: true,
      processingState: 'SUCCEEDED',
      processedAt,
      safeMetadata: nextMetadata,
    },
  })

  if (SUCCESS_STATUSES.has(status)) {
    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : null
    const interval = plan?.interval ?? 'MONTHLY'
    const length = interval === 'WEEKLY' ? 7 * DAY_MS : 30 * DAY_MS

    if (userId && plan) {
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          planId,
          status: 'ACTIVE',
          currentPeriodStart: processedAt,
          currentPeriodEnd: new Date(processedAt.getTime() + length),
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          planId,
          status: 'ACTIVE',
          currentPeriodStart: processedAt,
          currentPeriodEnd: new Date(processedAt.getTime() + length),
          cancelAtPeriodEnd: false,
        },
      })
    }
  }

  if (FAILURE_STATUSES.has(status)) {
    if (userId) {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: 'UNPAID' },
      })
    }
  }

  return { handled: true }
}
