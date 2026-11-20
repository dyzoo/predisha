import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import {
  deleteSlipDesign,
  duplicateSlipDesign,
  getSlipDesign,
  setSlipDesignStatus,
  slipDesignActionSchema,
  slipDesignInputSchema,
  updateSlipDesign,
} from '@/lib/bet/slip-designs'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const { id } = await params
    return json({ slip: await getSlipDesign(id) })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function PATCH(request: Request, { params }: Context) {
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
    const { id } = await params
    const input = await readJson(request, slipDesignInputSchema)
    const slip = await updateSlipDesign({
      id,
      input,
      actorId: access.viewer.userId,
      ipAddress: requestIp(request),
    })
    return json({ slip })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function POST(request: Request, { params }: Context) {
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
    const { id } = await params
    const { action } = await readJson(request, slipDesignActionSchema)
    const actorId = access.viewer.userId
    const ipAddress = requestIp(request)

    if (action === 'duplicate') {
      const slip = await duplicateSlipDesign({ id, actorId, ipAddress })
      return json({ slip }, { status: 201 })
    }

    const slip = await setSlipDesignStatus({
      id,
      status: action === 'mark-won' ? 'WON' : 'READY',
      actorId,
      ipAddress,
    })
    return json({ slip })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
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
    const { id } = await params
    const code = await deleteSlipDesign({
      id,
      actorId: access.viewer.userId,
      ipAddress: requestIp(request),
    })
    return json({ deleted: code })
  } catch (error) {
    return handleBetError(error)
  }
}
