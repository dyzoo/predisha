import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import {
  closeAdminBetSlip,
  deleteAdminBetSlip,
  freezeAdminBetSlip,
  getAdminBetSlipByCode,
  unfreezeAdminBetSlip,
} from '@/lib/bet/slips'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { readJson } from '@/lib/bet/security'
import { adminSlipActionSchema } from '@/lib/bet/validation'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const { code } = await params
    const slip = await getAdminBetSlipByCode(code)
    return json({ slip })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
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
    const actorId = access.viewer.userId
    if (!actorId) {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const { code } = await params
    const input = await readJson(request, adminSlipActionSchema)
    const slip = await getAdminBetSlipByCode(code)

    if (input.action === 'freeze') {
      const updated = await freezeAdminBetSlip({
        id: slip.id,
        reason: input.reason,
        actorId,
        now: new Date(),
      })
      return json({ slip: updated })
    }

    if (input.action === 'close') {
      const updated = await closeAdminBetSlip({
        id: slip.id,
        reason: input.reason,
        actorId,
        now: new Date(),
      })
      return json({ slip: updated })
    }

    const updated = await unfreezeAdminBetSlip({ id: slip.id, actorId, now: new Date() })
    return json({ slip: updated })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
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
    const { code } = await params
    const slip = await getAdminBetSlipByCode(code)
    const result = await deleteAdminBetSlip({
      id: slip.id,
      actorId: access.viewer.userId,
      ipAddress: requestIp(request),
    })
    return json({ deleted: result.code })
  } catch (error) {
    return handleBetError(error)
  }
}