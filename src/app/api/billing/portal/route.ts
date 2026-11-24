import { apiError, json } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { getBillingProvider } from '@/lib/billing/provider'
import { SETTLO_PROVIDER_NAME } from '@/lib/billing/settlo'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in to manage billing.', 401)

  const provider = getBillingProvider()
  const session = await provider.createPortalSession(viewer.userId)
  if (!session) {
    return apiError(
      provider.name === SETTLO_PROVIDER_NAME
        ? 'The SettloPay mobile-money flow does not expose a hosted billing portal.'
        : 'The billing portal is not configured. No payment provider integration is active on this deployment.',
      503,
    )
  }

  return json({ data: session })
}
