import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { AVIATOR_SETTING_PREFIX, getAviatorConfig, setAviatorConfig } from '@/lib/bet/aviator-config'
import { crashPointFor } from '@/lib/bet/aviator'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { aviatorSettingsSchema } from '@/lib/bet/validation'
import { prisma } from '@/lib/prisma'

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

async function requireAdmin() {
  const access = await getAdminAccess()
  if (access.status === 'unconfigured') {
    return { error: json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 }) }
  }
  if (access.status !== 'ok' || !access.viewer.userId) {
    return { error: json({ error: 'Admin access required.' }, { status: 403 }) }
  }
  return { access, actorId: access.viewer.userId }
}

export async function GET() {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const config = await getAviatorConfig()
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [activeBets, lifetime, lastDay] = await Promise.all([
      prisma.betAviatorBet.count({ where: { status: 'ACTIVE' } }),
      prisma.betAviatorBet.aggregate({
        _count: { _all: true },
        _sum: { stakeMinor: true, payoutMinor: true },
      }),
      prisma.betAviatorBet.aggregate({
        where: { createdAt: { gte: dayAgo } },
        _count: { _all: true },
        _sum: { stakeMinor: true, payoutMinor: true },
      }),
    ])

    const currentIndex = Math.floor(Date.now() / config.roundMs)
    const history = Array.from({ length: 20 }, (_, offset) => {
      const index = currentIndex - 1 - offset
      const roundId = `av-${index}`
      return { roundId, crashAt: crashPointFor(roundId, config) }
    })

    return json({
      config,
      stats: {
        activeBets,
        lifetimeBets: lifetime._count._all,
        lifetimeStakeMinor: lifetime._sum.stakeMinor ?? 0,
        lifetimePayoutMinor: lifetime._sum.payoutMinor ?? 0,
        lastDayBets: lastDay._count._all,
        lastDayStakeMinor: lastDay._sum.stakeMinor ?? 0,
        lastDayPayoutMinor: lastDay._sum.payoutMinor ?? 0,
      },
      history,
      settingPrefix: AVIATOR_SETTING_PREFIX,
    })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: 'Invalid origin.' }, { status: 403 })
    }
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const input = await readJson(request, aviatorSettingsSchema)
    const config = await setAviatorConfig({
      config: {
        enabled: input.enabled,
        waitMs: input.waitSeconds * 1000,
        roundMs: input.roundSeconds * 1000,
        growth: input.growth,
        maxCrash: input.maxCrash,
        houseEdge: input.houseEdge,
      },
      actorId: guard.actorId,
      ipAddress: requestIp(request),
    })

    return json({ config })
  } catch (error) {
    return handleBetError(error)
  }
}
