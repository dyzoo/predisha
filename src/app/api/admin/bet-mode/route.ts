import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { setBetMode } from '@/lib/bet/mode'

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: 'Invalid origin.' }, { status: 403 })
    }
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const body = await request.json().catch(() => null)
    const mode = body?.mode
    if (mode !== 'LIVE' && mode !== 'SANDBOX') {
      return json({ error: 'Mode must be LIVE or SANDBOX.' }, { status: 422 })
    }
    const updated = await setBetMode(mode, access.viewer.userId)
    return json({ mode: updated })
  } catch (error) {
    return handleBetError(error)
  }
}