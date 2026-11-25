import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Receipt, SlidersHorizontal } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminBetModeToggle } from '@/components/admin/admin-bet-mode-toggle'
import { AdminDepositMinimum } from '@/components/admin/admin-deposit-minimum'
import { AdminSlipGenerator } from '@/components/admin/admin-slip-generator'
import { AdminSlipList, type AdminSlipListItemView } from '@/components/admin/admin-slip-list'
import { AdminNav } from '@/components/admin/admin-nav'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { settloApiKeyConfigured } from '@/lib/billing/settlopay'
import { getDepositMinMinor } from '@/lib/bet/deposit-settings'
import { getBetMode } from '@/lib/bet/mode'
import { buildAdminSlipRecommendation } from '@/lib/bet/recommendation'
import { listAdminBetSlips } from '@/lib/bet/slips'

export const metadata: Metadata = {
  title: 'Admin bets',
}

export default async function AdminBetsPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <AdminShell eyebrow="Admin" title="Bets">
        <AdminAccessState status="unconfigured" />
      </AdminShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/bets')
  if (!canViewAdmin(viewer)) {
    return (
      <AdminShell eyebrow="Admin" title="Bets">
        <AdminAccessState status="forbidden" />
      </AdminShell>
    )
  }

  const [mode, minDepositMinor, recommendation, slips] = await Promise.all([
    getBetMode(),
    getDepositMinMinor(),
    buildAdminSlipRecommendation(),
    listAdminBetSlips(),
  ])

  const slipItems: AdminSlipListItemView[] = slips.map(slip => ({
    id: slip.id,
    code: slip.code,
    title: slip.title,
    mode: slip.mode,
    status: slip.status,
    timeMode: slip.timeMode,
    selectionSource: slip.selectionSource,
    manualKickoffAt: slip.manualKickoffAt,
    simulatedDurationMinutes: slip.simulatedDurationMinutes,
    liveStartedAt: slip.liveStartedAt,
    frozen: slip.frozen,
    frozenReason: slip.frozenReason,
    autoFreezeAt: slip.autoFreezeAt,
    createdAt: slip.createdAt,
    stakeMinor: slip.stakeMinor,
    totalOdds: slip.totalOdds,
    potentialReturnMinor: slip.potentialReturnMinor,
    vatMinor: slip.vatMinor,
    netPayoutMinor: slip.netPayoutMinor,
    entryCount: slip.entryCount,
    paidCount: slip.paidCount,
    entries: slip.entries.map(entry => ({
      id: entry.id,
      phoneMasked: entry.phoneMasked,
      userId: entry.userId,
      userName: entry.userName,
      stakeMinor: entry.stakeMinor,
      status: entry.status,
      ticketId: entry.ticketId,
      ticketCode: entry.ticketCode,
      ticketStatus: entry.ticketStatus,
      ticketPayoutMinor: entry.ticketPayoutMinor,
      failureReason: entry.failureReason,
      paidAt: entry.paidAt,
      createdAt: entry.createdAt,
    })),
    selections: slip.selections.map(selection => ({
      fixtureId: selection.fixtureId,
      fixtureLabel: selection.fixtureLabel,
      marketName: selection.marketName,
      selectionLabel: selection.selectionLabel,
      odds: selection.odds,
      kickoffIso: selection.kickoffIso,
      kickoffLabel: selection.kickoffLabel ?? null,
      finalScore: selection.finalScore ?? null,
      liveScore: selection.liveScore ?? null,
      liveMinute: selection.liveMinute ?? null,
    })),
  }))

  return (
    <AdminShell
      eyebrow="Admin"
      title="Bet control"
      intro="Switch the platform between live and sandbox, build slips from model picks, manual fixtures or random teams, set original/manual/simulated timing, then start or freeze a slip when you need to."
    >
      <AdminNav active="/admin/bets" />

      <AdminBetModeToggle mode={mode} />

      <AdminDepositMinimum minDepositMinor={minDepositMinor} />

      {!settloApiKeyConfigured() ? (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200">
          Settlo Pay is not loaded on this server, so live mobile-money payments will
          return a configuration error. Add <code className="font-mono">SETTLO_API_KEY</code> to
          <code className="font-mono"> .env.local</code> and restart the app, or keep the platform in
          Sandbox mode for test slips.
        </section>
      ) : null}

      <AdminSlipGenerator recommendation={recommendation} />

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Receipt className="h-4 w-4 text-accent" />
          Recent slips
        </h2>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-text">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Original-time slips freeze at kickoff; manual and simulated slips use the time you set.
          Admins can start simulated live matches, freeze, close, delete or filter previous slips here.
        </p>
      </section>

      <AdminSlipList slips={slipItems} />
    </AdminShell>
  )
}

export const instant = false