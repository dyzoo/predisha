import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminNav } from '@/components/admin/admin-nav'
import {
  AdminWinnerList,
  type AdminWinnerListItemView,
} from '@/components/admin/admin-winner-list'
import {
  AdminWinnerForm,
  type WinnerUserOption,
} from '@/components/admin/admin-winner-form'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { listActiveWinnerSources, listWinnerSlips } from '@/lib/bet/winners'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Admin winners',
}

export default async function AdminWinnersPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <AdminShell eyebrow="Admin" title="Winners">
        <AdminAccessState status="unconfigured" />
      </AdminShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/winners')
  if (!canViewAdmin(viewer)) {
    return (
      <AdminShell eyebrow="Admin" title="Winners">
        <AdminAccessState status="forbidden" />
      </AdminShell>
    )
  }

  const [users, winners, sources] = await Promise.all([
    prisma.user.findMany({
      where: {
        email: { not: { endsWith: '@guest.spotibet.invalid' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        betWallet: { select: { balanceMinor: true } },
      },
    }),
    listWinnerSlips(),
    listActiveWinnerSources(),
  ])

  const userOptions: WinnerUserOption[] = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    balanceMinor: user.betWallet?.balanceMinor ?? 0,
  }))

  const winnerItems: AdminWinnerListItemView[] = winners.map(winner => ({
    id: winner.id,
    code: winner.code,
    title: winner.title,
    userName: winner.userName,
    userEmail: winner.userEmail,
    stakeMinor: winner.stakeMinor,
    totalOdds: winner.totalOdds,
    grossPayoutMinor: winner.grossPayoutMinor,
    vatMinor: winner.vatMinor,
    netPayoutMinor: winner.netPayoutMinor,
    ticketCode: winner.ticketCode,
    creditedAt: winner.creditedAt,
    createdAt: winner.createdAt,
    selections: winner.selections.map(selection => ({
      fixtureLabel: selection.fixtureLabel,
      marketName: selection.marketName,
      selectionLabel: selection.selectionLabel,
      odds: selection.odds,
      finalScore: selection.finalScore,
    })),
  }))

  return (
    <AdminShell
      eyebrow="Admin"
      title="Winner payouts"
      intro="Choose a registered user, select teams and winning selections from the fixture API, set the payout date, and credit the wallet after the 10% VAT deduction."
    >
      <AdminNav active="/admin/winners" />

      <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-relaxed text-amber-100">
        Winners receive a completed ticket in My Bets and an instant wallet credit. The payment
        gateway is bypassed for withdrawals during this phase, so the user sees a success message
        after submitting their mobile number.
      </section>

      <AdminWinnerForm users={userOptions} sources={sources} />

      <AdminWinnerList winners={winnerItems} />
    </AdminShell>
  )
}

export const instant = false
