import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getBillingProvider } from '@/lib/billing/provider'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

const checkoutSchema = z.object({
  planId: z.enum(['weekly', 'monthly']),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number.')
    .optional(),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in before starting checkout.', 401)

  const limit = rateLimit(clientKey(request, 'billing-checkout'), 5, 60_000)
  if (!limit.ok) {
    return apiError('Too many checkout attempts. Try again shortly.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Enter a valid plan and phone number.', 422, {
      issues: parsed.error.issues.map(issue => issue.message),
    })
  }

  const provider = getBillingProvider()
  if (provider.name === 'disabled') {
    return apiError(
      'Checkout is not open. Live billing stays disabled until the payment provider approves the business model, entity and target markets.',
      503,
    )
  }

  if (provider.name === 'harakapay' && !parsed.data.phone) {
    return apiError('Enter a valid phone number to receive the USSD push.', 422, {
      fields: { phone: 'Enter a valid phone number.' },
    })
  }

  const checkout = await provider.createCheckoutSession(viewer.userId, parsed.data.planId, {
    phone: parsed.data.phone ?? null,
  })
  if (!checkout) {
    return apiError('Checkout could not be started. The billing provider is not ready yet.', 503)
  }

  return json({ data: checkout })
}
