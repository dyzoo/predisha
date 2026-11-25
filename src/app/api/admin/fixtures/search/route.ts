import { apiError, json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { searchAdminFixtureSuggestions } from '@/lib/bet/slip-reconciliation'

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 30

export async function GET(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const access = await getAdminAccess()
  if (access.status !== 'ok') return apiError('Admin access required.', 403)

  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return apiError('Enter at least two characters to search teams.', 422)

  const rawLimit = url.searchParams.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return apiError(`limit must be an integer between 1 and ${MAX_LIMIT}.`, 422)
  }

  const suggestions = await searchAdminFixtureSuggestions(query, new Date(), limit).catch(() => [])
  return json({ ok: true, query, suggestions })
}
