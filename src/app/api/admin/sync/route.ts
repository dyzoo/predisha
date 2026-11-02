import { json, apiError } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { syncFootballData } from '@/lib/sports/sync'

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const access = await getAdminAccess()
  if (access.status !== 'ok') {
    return apiError('Admin access required.', 403)
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
