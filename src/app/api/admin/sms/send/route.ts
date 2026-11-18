import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { sendNextSms } from '@/lib/billing/nextsms'
import { BetError, handleBetError } from '@/lib/bet/errors'
import { maskTzPhone, normalizeTzPhone } from '@/lib/bet/phone'
import { readJson } from '@/lib/bet/security'
import { adminSendSmsSchema } from '@/lib/bet/validation'
import { prisma } from '@/lib/prisma'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
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
    if (access.status !== 'ok' || !access.viewer.userId) {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }

    const input = await readJson(request, adminSendSmsSchema)
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, phone: true },
    })
    if (!user) throw new BetError('That user could not be found.', 404, 'USER_NOT_FOUND')
    if (!user.phone) {
      throw new BetError('That user has not registered a mobile number.', 422, 'NO_PHONE')
    }
    const normalized = normalizeTzPhone(user.phone)
    if (!normalized.ok) {
      throw new BetError(normalized.error ?? 'That mobile number is invalid.', 422, 'BAD_PHONE')
    }

    const result = await sendNextSms({
      to: [normalized.phone],
      text: input.message,
      reference: `admin:${access.viewer.userId.slice(-8)}`,
    })

    await prisma.adminAuditLog
      .create({
        data: {
          actorId: access.viewer.userId,
          action: 'admin.sms.send',
          target: user.email,
          ipAddress: requestIp(request),
          metadata: {
            userId: input.userId,
            phone: maskTzPhone(normalized.phone),
            message: input.message,
            sentCount: result.sentCount,
            failedCount: result.failedCount,
            ...(result.error ? { error: result.error } : {}),
          },
        },
      })
      .catch(() => undefined)

    return json(result, { status: result.success ? 200 : 502 })
  } catch (error) {
    return handleBetError(error)
  }
}
