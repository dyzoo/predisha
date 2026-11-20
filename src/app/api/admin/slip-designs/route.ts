import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { createSlipDesign, listSlipDesigns, slipDesignInputSchema } from '@/lib/bet/slip-designs'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function GET() {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    return json({ slips: await listSlipDesigns() })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: 'Invalid origin.' }, { status: 403 })
    }
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok' || !access.viewer.userId) {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const input = await readJson(request, slipDesignInputSchema)
    const slip = await createSlipDesign({
      input,
      actorId: access.viewer.userId,
      ipAddress: requestIp(request),
    })
    return json({ slip }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
