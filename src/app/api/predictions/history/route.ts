import { apiError, json } from '@/lib/api'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getViewer } from '@/lib/auth/session'
import { HISTORY_LIMIT, listPredictionHistory } from '@/lib/predictions/history'

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, 'prediction-history'), 30, 60_000)
  if (!limit.ok) {
    return apiError('Too many requests. Try again shortly.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in to view prediction history.', 401)

  try {
    const { slips, summary } = await listPredictionHistory(viewer.userId, HISTORY_LIMIT)
    return json({ data: slips, meta: { ...summary, limit: HISTORY_LIMIT } })
  } catch {
    return apiError('Prediction history is unavailable right now.', 503)
  }
}
