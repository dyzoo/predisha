import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { listAdminBetSlips, createAdminBetSlip } from '@/lib/bet/slips'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { readJson } from '@/lib/bet/security'
import { adminSlipCreateSchema } from '@/lib/bet/validation'

export async function GET() {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const slips = await listAdminBetSlips()
    return json({ slips })
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
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const createdBy = access.viewer.userId
    if (!createdBy) {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const input = await readJson(request, adminSlipCreateSchema)
    const slip = await createAdminBetSlip({
      createdBy,
      title: input.title,
      stakeMinor: input.stakeMinor,
      selections: input.selections,
      now: new Date(),
    })
    return json({ slip, shareUrl: `/bet/share/${slip.code}` }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}