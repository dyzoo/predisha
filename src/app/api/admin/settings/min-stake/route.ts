import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { getMinStakeMinor, setMinStakeMinor } from '@/lib/bet/stake-settings'
import { MAX_STAKE_MINOR, MIN_STAKE_MINOR } from '@/lib/bet/types'

const minStakeSchema = z.object({
  amountMinor: z.number().int().min(MIN_STAKE_MINOR).max(MAX_STAKE_MINOR),
})

async function requireAdmin() {
  const access = await getAdminAccess()
  if (access.status === 'unconfigured') {
    return { error: apiError('Admin is not configured on this deployment yet.', 503) }
  }
  if (access.status !== 'ok' || !access.viewer.userId) {
    return { error: apiError('Admin access required.', 403) }
  }
  return { actorId: access.viewer.userId }
}

export async function GET() {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error
    return json({ minStakeMinor: await getMinStakeMinor() })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const input = await readJson(request, minStakeSchema)
    const minStakeMinor = await setMinStakeMinor({
      amountMinor: input.amountMinor,
      actorId: guard.actorId,
    })
    return json({ minStakeMinor })
  } catch (error) {
    return handleBetError(error)
  }
}
