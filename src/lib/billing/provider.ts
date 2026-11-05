import { prisma } from '@/lib/prisma'
import {
  HARAKAPAY_PROVIDER_NAME,
  createHarakaPayOrder,
  harakapayApiKeyConfigured,
  verifyHarakaPayWebhook,
  type HarakaPayWebhookEvent,
} from '@/lib/billing/harakapay'

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
}

export function isBillingEnabled(): boolean {
  const providerName = process.env.BILLING_PROVIDER ?? 'disabled'
  return process.env.BILLING_LIVE_ENABLED === 'true' && providerName !== 'disabled'
}

export function getBillingProvider(): BillingProvider {
  if (!isBillingEnabled()) {
    return new DisabledBillingProvider()
  }
  if (process.env.BILLING_PROVIDER === HARAKAPAY_PROVIDER_NAME) {
    return new HarakaPayBillingProvider()
  }
  return new DisabledBillingProvider()
}
