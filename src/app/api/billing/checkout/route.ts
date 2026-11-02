import { apiError } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in before starting checkout.', 401)

  return apiError(
    'Checkout is not open. Live billing stays disabled until the payment provider approves the business model, entity and target markets.',
    503,
  )
}
