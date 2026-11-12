import type { z } from 'zod'
import { zodFieldErrors } from '@/lib/auth/credentials'
import type { Viewer } from '@/lib/auth/entitlements'
import { isSameOrigin } from '@/lib/auth/origin'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getViewer } from '@/lib/auth/session'
import { BetError } from './errors'

export type AuthenticatedViewer = Viewer & { userId: string }

export function guardMutation(
  request: Request,
  suffix: string,
  limit = 30,
  windowMs = 60_000,
): void {
  if (!isSameOrigin(request)) {
    throw new BetError('Invalid request origin.', 403, 'BAD_ORIGIN')
  }
  const limited = rateLimit(clientKey(request, `bet:${suffix}`), limit, windowMs)
  if (!limited.ok) {
    throw new BetError('Too many requests. Try again shortly.', 429, 'RATE_LIMITED', {
      retryAfterSeconds: limited.retryAfterSeconds,
    })
  }
}

export async function requireViewer(): Promise<AuthenticatedViewer> {
  const viewer = await getViewer()
  if (!viewer.userId) {
    throw new BetError('Sign in to continue.', 401, 'AUTH_REQUIRED')
  }
  return viewer as AuthenticatedViewer
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    throw new BetError('Request body is too large.', 413, 'BODY_TOO_LARGE')
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new BetError('Invalid JSON body.', 400, 'INVALID_JSON')
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new BetError('Check the highlighted fields and try again.', 422, 'VALIDATION', {
      fields: zodFieldErrors(parsed.error),
    })
  }
  return parsed.data
}
