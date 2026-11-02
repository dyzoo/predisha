import { apiError, json } from '@/lib/api'
import { signInSchema, zodFieldErrors } from '@/lib/auth/credentials'
import { isSameOrigin } from '@/lib/auth/origin'
import { verifyPassword } from '@/lib/auth/password'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { createSession, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

// Used when the email is unknown so failed sign-ins take a similar amount of
// time whether or not an account exists.
const DUMMY_PASSWORD_HASH = '$2b$12$/4R5yt3nJgZgFei94mpEU.TWSgj2cYxS2043wEgqW5024Dy33DNdC'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }

  const limited = rateLimit(clientKey(request, 'sign-in'), 10, 10 * 60 * 1000)
  if (!limited.ok) {
    return apiError('Too many attempts. Try again later.', 429, {
      retryAfterSeconds: limited.retryAfterSeconds,
    })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return apiError('Invalid JSON body.', 400)
  }

  const parsed = signInSchema.safeParse(payload)
  if (!parsed.success) {
    return apiError('Enter a valid email and password.', 422, {
      fields: zodFieldErrors(parsed.error),
    })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    )
    if (!user || !valid) {
      return apiError('Email or password is incorrect.', 401)
    }

    await createSession(user.id)
    return json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch {
    return apiError('Authentication is temporarily unavailable.', 503)
  }
}
