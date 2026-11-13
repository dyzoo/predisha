import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { buildAdminSlipRecommendation } from '@/lib/bet/recommendation'
import { handleBetError } from '@/lib/bet/errors'

export async function GET() {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    const recommendation = await buildAdminSlipRecommendation()
    return json(recommendation)
  } catch (error) {
    return handleBetError(error)
  }
}
