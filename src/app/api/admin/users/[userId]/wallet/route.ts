import { apiError, json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { prisma } from '@/lib/prisma'
import { BetError } from '@/lib/bet/errors'
import { randomCode } from '@/lib/bet/random'
import { creditWallet } from '@/lib/bet/wallet'
import { adminWalletFundSchema } from '@/lib/bet/validation'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const access = await getAdminAccess()
  if (access.status === 'unconfigured') {
    return apiError('Admin is not configured on this deployment yet.', 503)
  }
  if (access.status !== 'ok') return apiError('Admin access required.', 403)

  const { userId } = await params
  const body = await request.json().catch(() => null)
  const parsed = adminWalletFundSchema.safeParse(body)
  if (!parsed.success) return apiError('Enter an amount between 1 and 1,000,000 TZS.', 422)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!target) return apiError('User not found.', 404)

  try {
    const wallet = await prisma.$transaction(async tx => {
      const updated = await creditWallet(tx, {
        userId: target.id,
        amountMinor: parsed.data.amountMinor,
        type: 'ADJUSTMENT',
        reference: `admin-fund:${access.viewer.userId}:${target.id}:${Date.now()}:${randomCode(8)}`,
        note: 'Wallet top-up',
        metadata: { actorId: access.viewer.userId },
      })
      await tx.adminAuditLog.create({
        data: {
          actorId: access.viewer.userId,
          action: 'admin.wallet.fund',
          target: target.email,
          ipAddress: requestIp(request),
          metadata: {
            userId: target.id,
            amountMinor: parsed.data.amountMinor,
            balanceMinor: updated.balanceMinor,
          },
        },
      })
      return updated
    })
    return json({ wallet })
  } catch (error) {
    if (error instanceof BetError) return apiError(error.message, error.status)
    return apiError('Could not add funds right now.', 503)
  }
}
