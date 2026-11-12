import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  HARAKAPAY_PROVIDER_NAME,
  confirmHarakaPayOrder,
  createHarakaPayOrder,
  harakapayApiKeyConfigured,
  verifyHarakaPayWebhook,
  type HarakaPayWebhookEvent,
} from '@/lib/billing/harakapay'

const DAY_MS = 24 * 60 * 60 * 1000
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
    options?: { phone?: string | null },
  ): Promise<BillingCheckout | null>
  createPortalSession(userId: string): Promise<{ url: string } | null>
  verifyWebhook(rawBody: string, signature: string | null): Promise<HarakaPayWebhookEvent | null>
  confirmCheckout(orderId: string): Promise<HarakaPayWebhookEvent | null>
}

export class DisabledBillingProvider implements BillingProvider {
  name = 'disabled'

  async createCheckoutSession(): Promise<BillingCheckout | null> {
    return null
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(): Promise<HarakaPayWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<HarakaPayWebhookEvent | null> {
    return null
  }
}

export class HarakaPayBillingProvider implements BillingProvider {
  name = HARAKAPAY_PROVIDER_NAME

  async createCheckoutSession(
    userId: string,
    planId: string,
    options?: { phone?: string | null },
  ): Promise<BillingCheckout | null> {
    if (!harakapayApiKeyConfigured()) return null

    const phone = options?.phone?.trim() ?? ''
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active || plan.amountMinor === null) return null

    const appUrl = (process.env.APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '')
    const order = await createHarakaPayOrder({
      phone,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      description: `Predisha ${plan.interval.toLowerCase()} premium subscription`,
      webhookUrl: `${appUrl}/api/webhooks/${HARAKAPAY_PROVIDER_NAME}`,
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
      provider: HARAKAPAY_PROVIDER_NAME,
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

  async verifyWebhook(rawBody: string, signature: string | null): Promise<HarakaPayWebhookEvent | null> {
    return verifyHarakaPayWebhook(rawBody, signature)
  }

  async confirmCheckout(orderId: string): Promise<HarakaPayWebhookEvent | null> {
    return confirmHarakaPayOrder(orderId)
  }
}

/**
 * Test-only provider. It activates a subscription immediately so the whole
 * subscribe -> entitlement flow can be exercised without a live payment
 * provider. It never runs unless explicitly selected and enabled outside
 * production (or with BILLING_TEST_MODE=true).
 */
export class ManualBillingProvider implements BillingProvider {
  name = MANUAL_PROVIDER_NAME

  async createCheckoutSession(userId: string, planId: string): Promise<BillingCheckout | null> {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active || plan.amountMinor === null) return null

    const now = new Date()
    const length = plan.interval === 'WEEKLY' ? 7 * DAY_MS : 30 * DAY_MS
    const currentPeriodEnd = new Date(now.getTime() + length)

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

  async verifyWebhook(): Promise<HarakaPayWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<HarakaPayWebhookEvent | null> {
    return null
  }
}

export function isBillingEnabled(): boolean {
  const providerName = process.env.BILLING_PROVIDER ?? 'disabled'
  return process.env.BILLING_LIVE_ENABLED === 'true' && providerName !== 'disabled'
}

export function isManualBillingAllowed(): boolean {
  return process.env.BILLING_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production'
}

export function getBillingProvider(): BillingProvider {
  if (!isBillingEnabled()) {
    return new DisabledBillingProvider()
  }
  if (process.env.BILLING_PROVIDER === HARAKAPAY_PROVIDER_NAME) {
    return new HarakaPayBillingProvider()
  }
  if (process.env.BILLING_PROVIDER === MANUAL_PROVIDER_NAME && isManualBillingAllowed()) {
    return new ManualBillingProvider()
  }
  return new DisabledBillingProvider()
}
