import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { planDurationMs } from './duration'
import {
  NORIPESA_PROVIDER_NAME,
  confirmNoripesaOrder,
  createNoripesaOrder,
  noripesaApiKeyConfigured,
  verifyNoripesaWebhook,
  type NoripesaWebhookEvent,
} from '@/lib/billing/noripesa'

const MANUAL_PROVIDER_NAME = 'manual'

export interface BillingPlan {
  id: string
  name: string
  interval: 'WEEKLY' | 'MONTHLY'
  amountMinor: number
  currency: string
}

export interface BillingCheckout {
  provider: string
  orderId: string | null
  status: string | null
  amountMinor: number | null
  currency: string | null
  url: string | null
  message: string
}

export interface BillingProvider {
  name: string
  createCheckoutSession(
    userId: string,
    planId: string,
    options?: { phone?: string | null; customerName?: string | null; customerEmail?: string | null },
  ): Promise<BillingCheckout | null>
  createPortalSession(userId: string): Promise<{ url: string } | null>
  verifyWebhook(rawBody: string, signature: string | null): Promise<NoripesaWebhookEvent | null>
  confirmCheckout(orderId: string): Promise<NoripesaWebhookEvent | null>
}

export class DisabledBillingProvider implements BillingProvider {
  name = 'disabled'

  async createCheckoutSession(): Promise<BillingCheckout | null> {
    return null
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(): Promise<NoripesaWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<NoripesaWebhookEvent | null> {
    return null
  }
}

export class NoripesaBillingProvider implements BillingProvider {
  name = NORIPESA_PROVIDER_NAME

  async createCheckoutSession(
    userId: string,
    planId: string,
    options?: { phone?: string | null; customerName?: string | null; customerEmail?: string | null },
  ): Promise<BillingCheckout | null> {
    if (!noripesaApiKeyConfigured()) return null

    const phone = options?.phone?.trim() ?? ''
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active || plan.amountMinor === null) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    const appUrl = (process.env.APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '')
    const order = await createNoripesaOrder({
      phone,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      description: `Spotibet ${plan.interval.toLowerCase()} premium subscription`,
      webhookUrl: `${appUrl}/api/webhooks/${NORIPESA_PROVIDER_NAME}`,
      customerName: options?.customerName ?? user?.name ?? null,
      customerEmail: options?.customerEmail ?? user?.email ?? null,
    })
    if (!order.success || !order.orderId) return null

    await prisma.billingEvent
      .create({
        data: {
          providerEventId: order.orderId,
          type: 'order.created',
          processed: true,
          processingState: 'PENDING',
          safeMetadata: {
            userId,
            planId,
            amountMinor: plan.amountMinor,
            currency: plan.currency,
            status: 'pending',
          },
        },
      })
      .catch(() => undefined)

    return {
      provider: NORIPESA_PROVIDER_NAME,
      orderId: order.orderId,
      status: order.status,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      url: null,
      message: 'USSD push sent',
    }
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<NoripesaWebhookEvent | null> {
    return verifyNoripesaWebhook(rawBody, signature)
  }

  async confirmCheckout(orderId: string): Promise<NoripesaWebhookEvent | null> {
    const result = await confirmNoripesaOrder(orderId)
    if (!result) return null
    return {
      provider: NORIPESA_PROVIDER_NAME,
      providerEventId: result.orderId ?? orderId,
      orderId: result.orderId ?? orderId,
      type: 'order.status',
      status: result.status,
      amountMinor: result.amount,
      currency: 'TZS',
      verified: true,
    }
  }
}

export class ManualBillingProvider implements BillingProvider {
  name = MANUAL_PROVIDER_NAME

  async createCheckoutSession(userId: string, planId: string): Promise<BillingCheckout | null> {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active || plan.amountMinor === null) return null

    const now = new Date()
    const currentPeriodEnd = new Date(now.getTime() + planDurationMs(plan))

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
    })

    await prisma.billingEvent
      .create({
        data: {
          providerEventId: `manual_${randomUUID()}`,
          type: 'manual.activated',
          processed: true,
          processingState: 'SUCCEEDED',
          processedAt: now,
          safeMetadata: { userId, planId: plan.id, status: 'completed' },
        },
      })
      .catch(() => undefined)

    return {
      provider: MANUAL_PROVIDER_NAME,
      orderId: null,
      status: 'active',
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      url: null,
      message: 'Test subscription activated',
    }
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(): Promise<NoripesaWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<NoripesaWebhookEvent | null> {
    return null
  }
}

export function isBillingEnabled(): boolean {
  const providerName = (process.env.BILLING_PROVIDER ?? 'disabled').trim().toLowerCase()
  if (process.env.BILLING_LIVE_ENABLED !== 'true' || providerName === 'disabled') return false
  if (providerName === NORIPESA_PROVIDER_NAME && !noripesaApiKeyConfigured()) return false
  return true
}

export function isManualBillingAllowed(): boolean {
  return process.env.BILLING_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production'
}

export function getBillingProvider(): BillingProvider {
  if (!isBillingEnabled()) {
    return new DisabledBillingProvider()
  }
  const providerName = (process.env.BILLING_PROVIDER ?? '').trim().toLowerCase()
  if (providerName === NORIPESA_PROVIDER_NAME) {
    return new NoripesaBillingProvider()
  }
  if (providerName === MANUAL_PROVIDER_NAME && isManualBillingAllowed()) {
    return new ManualBillingProvider()
  }
  return new DisabledBillingProvider()
}
