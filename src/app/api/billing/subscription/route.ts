import { connection } from 'next/server'
import { apiError, json } from '@/lib/api'
import { getBillingProvider } from '@/lib/billing/provider'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await connection()
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in to view your subscription.', 401)

  const provider = getBillingProvider()

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: viewer.userId },
      select: {
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: {
          select: {
            id: true,
            name: true,
            interval: true,
            amountMinor: true,
            currency: true,
          },
        },
      },
    })
    return json({
      data: subscription,
      meta: {
        entitlement: viewer.entitlement,
        billingEnabled: provider.name !== 'disabled',
        provider: provider.name,
      },
    })
  } catch {
    return apiError('Subscription data is temporarily unavailable.', 503)
  }
}
