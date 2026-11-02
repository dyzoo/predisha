import { json, apiError } from '@/lib/api'
import { syncFootballData } from '@/lib/sports/sync'

export async function POST(request: Request): Promise<Response> {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) {
    return apiError('Cron is not configured on this deployment.', 503)
  }

  const authorization = request.headers.get('authorization') ?? ''
  const secret = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (secret !== configuredSecret) {
    return apiError('Unauthorized.', 401)
  }

  try {
    const result = await syncFootballData()
    return json({ ok: true, synced: result })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Sync failed.',
      500,
    )
  }
}
