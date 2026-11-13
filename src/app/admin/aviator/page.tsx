import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Plane } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminAviatorSettings } from '@/components/admin/admin-aviator-settings'
import { AdminNav } from '@/components/admin/admin-nav'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { crashPointFor } from '@/lib/bet/aviator'
import { DEFAULT_AVIATOR_CONFIG, getAviatorConfig } from '@/lib/bet/aviator-config'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Admin Aviator',
}

export default async function AdminAviatorPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Admin" title="Aviator">
        <AdminAccessState status="unconfigured" />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/aviator')
  if (!canViewAdmin(viewer)) {
    return (
      <PageShell eyebrow="Admin" title="Aviator">
        <AdminAccessState status="forbidden" />
      </PageShell>
    )
  }

  const config = await getAviatorConfig()
  const dayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
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

  const currentIndex = Math.floor(new Date().getTime() / config.roundMs)
  const history = Array.from({ length: 20 }, (_, offset) => {
    const index = currentIndex - 1 - offset
    const roundId = `av-${index}`
    return { roundId, crashAt: crashPointFor(roundId, config) }
  })

  return (
    <PageShell
      eyebrow="Admin"
      title="Aviator control"
      intro="Tune the Aviator round engine, pause betting, and watch live stake and payout activity. Changes are persisted server-side and audited."
    >
      <AdminNav active="/admin/aviator" />

      {!config.enabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200">
          <Plane className="mt-0.5 h-4 w-4 shrink-0" />
          Betting is currently paused. Players can watch rounds but cannot place new bets until it
          is enabled again.
        </div>
      ) : null}

      <AdminAviatorSettings
        initialConfig={config}
        defaults={DEFAULT_AVIATOR_CONFIG}
        stats={{
          activeBets,
          lifetimeBets: lifetime._count._all,
          lifetimeStakeMinor: lifetime._sum.stakeMinor ?? 0,
          lifetimePayoutMinor: lifetime._sum.payoutMinor ?? 0,
          lastDayBets: lastDay._count._all,
          lastDayStakeMinor: lastDay._sum.stakeMinor ?? 0,
          lastDayPayoutMinor: lastDay._sum.payoutMinor ?? 0,
        }}
        history={history}
      />
    </PageShell>
  )
}

export const instant = false
