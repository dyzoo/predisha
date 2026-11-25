import { prisma } from '@/lib/prisma'
import { mapSettloState, type SettloWebhookEvent } from '@/lib/billing/settlopay'
import { planDurationMs } from './duration'

export async function applyBillingWebhookEvent(
  event: SettloWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }

  const existing = await prisma.billingEvent.findUnique({
    where: { providerEventId: event.orderId },
  })
  if (!existing) return { handled: false }

  const metadata = (existing.safeMetadata ?? {}) as Record<string, unknown>
  const previousState = typeof metadata.status === 'string' ? metadata.status : null
  if (existing.processed && existing.type === event.type && previousState === event.status) {
    return { handled: true }
  }

  const userId = typeof metadata.userId === 'string' ? metadata.userId : null
  const planId = typeof metadata.planId === 'string' ? metadata.planId : null
  const outcome = mapSettloState(event.status)
  const processedAt = new Date()

  await prisma.billingEvent.upsert({
    where: { providerEventId: event.orderId },
    update: {
      type: event.type,
      processed: true,
      processingState: 'SUCCEEDED',
      processedAt,
      safeMetadata: { ...metadata, status: event.status ?? 'UNKNOWN', updatedAt: processedAt.toISOString() },
    },
    create: {
      providerEventId: event.orderId,
      type: event.type,
      processed: true,
      processingState: 'SUCCEEDED',
      processedAt,
      safeMetadata: { ...metadata, status: event.status ?? 'UNKNOWN', updatedAt: processedAt.toISOString() },
    },
  })

  if (outcome === 'PAID' && mapSettloState(previousState) !== 'PAID') {
    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : null
    if (userId && planId && plan) {
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          planId,
          status: 'ACTIVE',
          currentPeriodStart: processedAt,
          currentPeriodEnd: new Date(processedAt.getTime() + planDurationMs(plan)),
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          planId,
          status: 'ACTIVE',
          currentPeriodStart: processedAt,
          currentPeriodEnd: new Date(processedAt.getTime() + planDurationMs(plan)),
          cancelAtPeriodEnd: false,
        },
      })
    }
  }

  if (outcome === 'FAILED' && userId) {
    await prisma.subscription.updateMany({
      where: { userId, status: { not: 'ACTIVE' } },
      data: { status: 'UNPAID' },
    })
  }

  return { handled: true }
}
