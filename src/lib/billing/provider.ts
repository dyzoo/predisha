export interface BillingPlan {
  id: string
  name: string
  interval: 'WEEKLY' | 'MONTHLY'
  amountMinor: number
  currency: string
}

export interface BillingProvider {
  name: string
  createCheckoutSession(userId: string, planId: string): Promise<{ url: string } | null>
  createPortalSession(userId: string): Promise<{ url: string } | null>
  verifyWebhook(rawBody: string, signature: string): Promise<unknown | null>
}

export class DisabledBillingProvider implements BillingProvider {
  name = 'disabled'

  async createCheckoutSession(): Promise<{ url: string } | null> {
    return null
  }

  async createPortalSession(): Promise<{ url: string } | null> {
    return null
  }

  async verifyWebhook(): Promise<unknown | null> {
    return null
  }
}

export function getBillingProvider(): BillingProvider {
  const enabled = process.env.BILLING_LIVE_ENABLED === 'true' && process.env.BILLING_PROVIDER && process.env.BILLING_PROVIDER !== 'disabled'
  if (!enabled) {
    return new DisabledBillingProvider()
  }
  // Only enable if explicitly approved/configured - default disabled
  return new DisabledBillingProvider()
}
