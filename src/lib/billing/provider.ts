import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { normalizeTzPhone } from '@/lib/bet/phone'
import { planDurationMs } from './duration'
import {
  SETTLO_PROVIDER_NAME,
  confirmSettloPayment,
  createSettloPayment,
  settloApiKeyConfigured,
  verifySettloWebhook,
  type SettloWebhookEvent,
} from '@/lib/billing/settlo'

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
  verifyWebhook(
    rawBody: string,
    signature: string | null,
    eventId?: string | null,
  ): Promise<SettloWebhookEvent | null>
  confirmCheckout(orderId: string): Promise<SettloWebhookEvent | null>
}

export class DisabledBillingProvider implements BillingProvider {
  name = 'disabled'

  async createCheckoutSession(): Promise<BillingCheckout | null> {
    return null
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(): Promise<SettloWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<SettloWebhookEvent | null> {
    return null
  }
}

export class SettloBillingProvider implements BillingProvider {
  name = SETTLO_PROVIDER_NAME

  async createCheckoutSession(
    userId: string,
    planId: string,
    options?: { phone?: string | null; customerName?: string | null; customerEmail?: string | null },
  ): Promise<BillingCheckout | null> {
    if (!settloApiKeyConfigured()) return null

    const normalized = normalizeTzPhone(options?.phone?.trim() ?? '')
    if (!normalized.ok) return null

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active || plan.amountMinor === null) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    const appUrl = (process.env.APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '')
    const order = await createSettloPayment({
      phone: normalized.phone,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      description: `Spotibet ${plan.interval.toLowerCase()} premium subscription`,
      customerName: options?.customerName ?? user?.name ?? null,
      customerEmail: options?.customerEmail ?? user?.email ?? null,
      returnUrl: `${appUrl}/settings/billing`,
      cancelUrl: `${appUrl}/settings/billing`,
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
            merchantReference: order.merchantReference,
            status: 'pending',
          },
        },
      })
      .catch(() => undefined)

    return {
      provider: SETTLO_PROVIDER_NAME,
      orderId: order.orderId,
      status: order.status,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      url: null,
      message: 'Mobile-money payment started',
    }
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(
    rawBody: string,
    signature: string | null,
    eventId?: string | null,
  ): Promise<SettloWebhookEvent | null> {
    return verifySettloWebhook(rawBody, signature, eventId)
  }

  async confirmCheckout(orderId: string): Promise<SettloWebhookEvent | null> {
    const result = await confirmSettloPayment(orderId)
    if (!result.success || !result.orderId) return null
    return {
      provider: SETTLO_PROVIDER_NAME,
      eventId: null,
      providerEventId: result.orderId,
      orderId: result.orderId,
      type: 'order.status',
      status: result.status,
      amountMinor: result.amountMinor,
      currency: result.currency ?? 'TZS',
      merchantReference: result.merchantReference,
      failureCode: result.failureCode,
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

  async verifyWebhook(): Promise<SettloWebhookEvent | null> {
    return null
  }

  async confirmCheckout(): Promise<SettloWebhookEvent | null> {
    return null
  }
}

export function isBillingEnabled(): boolean {
  const providerName = (process.env.BILLING_PROVIDER ?? 'disabled').trim().toLowerCase()
  if (process.env.BILLING_LIVE_ENABLED !== 'true' || providerName === 'disabled') return false
  if (providerName === SETTLO_PROVIDER_NAME && !settloApiKeyConfigured()) return false
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
  if (providerName === SETTLO_PROVIDER_NAME) {
    return new SettloBillingProvider()
  }
  if (providerName === MANUAL_PROVIDER_NAME && isManualBillingAllowed()) {
    return new ManualBillingProvider()
  }
  return new DisabledBillingProvider()
}
