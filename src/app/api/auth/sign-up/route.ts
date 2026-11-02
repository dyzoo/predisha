import { apiError, json } from '@/lib/api'
import { signUpSchema, zodFieldErrors } from '@/lib/auth/credentials'
import { isSameOrigin } from '@/lib/auth/origin'
import { hashPassword } from '@/lib/auth/password'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { createSession, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }

  const limited = rateLimit(clientKey(request, 'sign-up'), 5, 10 * 60 * 1000)
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

  const parsed = signUpSchema.safeParse(payload)
  if (!parsed.success) {
    return apiError('Check the highlighted fields and try again.', 422, {
      fields: zodFieldErrors(parsed.error),
    })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) {
      const message = 'An account with that email already exists.'
      return apiError(message, 409, { fields: { email: message } })
    }

    const passwordHash = await hashPassword(parsed.data.password)
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        preferences: { create: {} },
      },
      select: { id: true, email: true, name: true, role: true },
    })
    await createSession(user.id)
    return json(
      { data: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 201 },
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const message = 'An account with that email already exists.'
      return apiError(message, 409, { fields: { email: message } })
    }
    return apiError('Authentication is temporarily unavailable.', 503)
  }
}
