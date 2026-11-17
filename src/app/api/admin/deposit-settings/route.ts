import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { getDepositMinMinor, setDepositMinMinor } from '@/lib/bet/deposit-settings'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { adminDepositMinSchema } from '@/lib/bet/validation'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

async function requireAdmin() {
  const access = await getAdminAccess()
  if (access.status === 'unconfigured') {
    return { error: json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 }) }
  }
  if (access.status !== 'ok' || !access.viewer.userId) {
    return { error: json({ error: 'Admin access required.' }, { status: 403 }) }
  }
  return { actorId: access.viewer.userId }
}

export async function GET() {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    return json({ minDepositMinor: await getDepositMinMinor() })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: 'Invalid origin.' }, { status: 403 })
    }
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const input = await readJson(request, adminDepositMinSchema)
    const minDepositMinor = await setDepositMinMinor({
      amountMinor: input.amountMinor,
      actorId: guard.actorId,
      ipAddress: requestIp(request),
    })

    return json({ minDepositMinor })
  } catch (error) {
    return handleBetError(error)
  }
}
