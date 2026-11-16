import { z } from 'zod'
import { json } from '@/lib/api'
import { getSuperAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { BetError, handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { prisma } from '@/lib/prisma'

const promoteAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(320),
})

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      throw new BetError('Invalid request origin.', 403, 'BAD_ORIGIN')
    }

    const access = await getSuperAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status === 'unauthenticated') {
      return json({ error: 'Sign in to continue.' }, { status: 401 })
    }
    if (access.status !== 'ok' || !access.viewer.userId) {
      return json({ error: 'Super admin access required.' }, { status: 403 })
    }

    const { email } = await readJson(request, promoteAdminSchema)
    const target = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!target) {
      throw new BetError(
        'No registered account uses that email. Ask them to sign up first.',
        404,
        'USER_NOT_FOUND',
      )
    }
    if (target.email.toLowerCase().endsWith('@guest.spotibet.invalid')) {
      throw new BetError('Guest accounts cannot become admins.', 400, 'GUEST_ACCOUNT')
    }
    if (target.id === access.viewer.userId) {
      throw new BetError('You already have super admin access.', 409, 'ALREADY_ADMIN')
    }
    if (target.role === 'SUPER_ADMIN') {
      throw new BetError('That account is already a super admin.', 409, 'ALREADY_ADMIN')
    }
    if (target.role === 'ADMIN') {
      throw new BetError('That account is already an admin.', 409, 'ALREADY_ADMIN')
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true },
    })

    await prisma.adminAuditLog.create({
      data: {
        actorId: access.viewer.userId,
        action: 'admin.create',
        target: target.email,
        ipAddress: requestIp(request),
        metadata: { from: target.role, to: 'ADMIN' },
      },
    })

    return json({ data: updated }, { status: 201 })
  } catch (error) {
    return handleBetError(error)
  }
}
