import { json, apiError } from '@/lib/api'
import { settleAllOpenTickets } from '@/lib/bet/bets'
import { syncFootballData } from '@/lib/sports/sync'

async function runCron(request: Request): Promise<Response> {
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
    let settled = 0
    try {
      settled = await settleAllOpenTickets()
    } catch (error) {
      console.error('[cron] could not settle tickets', error)
    }
    return json({ ok: true, synced: result, settled })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Sync failed.',
      500,
    )
  }
}

export async function GET(request: Request): Promise<Response> {
  return runCron(request)
}

export async function POST(request: Request): Promise<Response> {
  return runCron(request)
}
