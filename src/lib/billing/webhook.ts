import { prisma } from '@/lib/prisma'
import type { SettloWebhookEvent } from '@/lib/billing/settlo'
import { planDurationMs } from './duration'

const SUCCESS_STATUSES = new Set(['completed', 'success', 'succeeded', 'paid', 'confirmed', 'chargeback_won'])
const FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'expired', 'blocked', 'chargeback_lost'])

export async function applyBillingWebhookEvent(
  event: SettloWebhookEvent,
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
    if (userId && plan) {
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
