import { apiError, json } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { destroySession, isAuthConfigured } from '@/lib/auth/session'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) return json({ data: { signedOut: true } })

  try {
    await destroySession()
    return json({ data: { signedOut: true } })
  } catch {
    return apiError('Could not sign out right now.', 503)
  }
}
