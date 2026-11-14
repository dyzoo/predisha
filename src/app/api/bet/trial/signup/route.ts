import { apiError, json } from '@/lib/api'
import { signUpSchema, zodFieldErrors } from '@/lib/auth/credentials'
import { isSameOrigin } from '@/lib/auth/origin'
import { hashPassword } from '@/lib/auth/password'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { createSession, isAuthConfigured } from '@/lib/auth/session'
import { claimTrialForUser, getTrialFromCookie } from '@/lib/bet/aviator-trial'
import { isUniqueConstraintError } from '@/lib/bet/errors'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }

  const limited = rateLimit(clientKey(request, 'trial-signup'), 6, 10 * 60 * 1000)
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
    const trialRecord = await getTrialFromCookie()
    const guest =
      trialRecord?.userId && existing?.id !== trialRecord.userId
        ? await prisma.user.findUnique({
            where: { id: trialRecord.userId },
            select: { id: true, passwordHash: true },
          })
        : null
    const guestUser = guest && !guest.passwordHash ? guest : null

    if (existing && existing.id !== guestUser?.id) {
      const message = 'An account with that email already exists.'
      return apiError(message, 409, { fields: { email: message } })
    }

    const passwordHash = await hashPassword(parsed.data.password)
    const user = guestUser
      ? await prisma.user.update({
          where: { id: guestUser.id },
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            passwordHash,
          },
          select: { id: true, email: true, name: true, role: true },
        })
      : await prisma.user.create({
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            passwordHash,
            preferences: { create: {} },
          },
          select: { id: true, email: true, name: true, role: true },
        })

    await createSession(user.id)

    let trial = null
    try {
      trial = await claimTrialForUser(user.id)
    } catch (error) {
      console.error('[aviator-trial] claim after signup failed', error)
    }

    return json(
      {
        data: { id: user.id, email: user.email, name: user.name, role: user.role },
        trial,
        redirectTo: '/bet/userAccount',
      },
      { status: 201 },
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const message = 'An account with that email already exists.'
      return apiError(message, 409, { fields: { email: message } })
    }
    console.error('[aviator-trial] signup failed', error)
    return apiError('Account setup is temporarily unavailable.', 503)
  }
}
