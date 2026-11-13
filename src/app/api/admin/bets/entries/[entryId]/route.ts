import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { retrySlipEntry } from '@/lib/bet/slip-payments'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
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
    const { entryId } = await params
    const entry = await retrySlipEntry(entryId)
    return json({ entry })
  } catch (error) {
    return handleBetError(error)
  }
}
