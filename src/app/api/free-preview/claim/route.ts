import { apiError, json } from '@/lib/api'
import { canViewPremium } from '@/lib/auth/entitlements'
import { claimFreePreview, getFreePreviewState } from '@/lib/auth/free-preview'
import { isSameOrigin } from '@/lib/auth/origin'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getViewer } from '@/lib/auth/session'

async function currentViewer() {
  const viewer = await getViewer()
  return viewer.userId ? viewer : null
}

export async function GET() {
  const viewer = await currentViewer()
  if (!viewer?.userId) return apiError('Sign in to view your free preview.', 401)

  const state = await getFreePreviewState(viewer.userId)
  return json({
    data: {
      recorded: state.recorded,
      used: state.used,
      claimedAt: state.claimedAt,
      premium: canViewPremium(viewer),
    },
  })
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const limit = rateLimit(clientKey(request, 'free-preview-claim'), 5, 60_000)
  if (!limit.ok) {
    return apiError('Too many requests. Try again shortly.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const viewer = await currentViewer()
  if (!viewer?.userId) return apiError('Sign in to claim your free preview.', 401)

  const result = await claimFreePreview(viewer.userId)
  if (result.state.used) {
    return apiError(
      'Your free prediction preview has already been used. Subscribe to premium to keep building slips.',
      409,
      { code: 'FREE_PREVIEW_USED', ...result.state },
    )
  }

  return json({
    data: {
      claimed: true,
      alreadyClaimed: result.alreadyClaimed,
      claimedAt: result.state.claimedAt,
      used: result.state.used,
    },
  })
}
