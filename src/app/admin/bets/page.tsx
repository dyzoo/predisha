import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Receipt, SlidersHorizontal } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminBetModeToggle } from '@/components/admin/admin-bet-mode-toggle'
import { AdminSlipGenerator } from '@/components/admin/admin-slip-generator'
import { AdminSlipList, type AdminSlipListItemView } from '@/components/admin/admin-slip-list'
import { AdminNav } from '@/components/admin/admin-nav'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { harakapayApiKeyConfigured } from '@/lib/billing/harakapay'
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
      <PageShell eyebrow="Admin" title="Bets">
        <AdminAccessState status="unconfigured" />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/bets')
  if (!canViewAdmin(viewer)) {
    return (
      <PageShell eyebrow="Admin" title="Bets">
        <AdminAccessState status="forbidden" />
      </PageShell>
    )
  }

  const [mode, recommendation, slips] = await Promise.all([
    getBetMode(),
    buildAdminSlipRecommendation(),
    listAdminBetSlips(),
  ])

  const slipItems: AdminSlipListItemView[] = slips.map(slip => ({
    id: slip.id,
    code: slip.code,
    title: slip.title,
    mode: slip.mode,
    status: slip.status,
    frozen: slip.frozen,
    frozenReason: slip.frozenReason,
    autoFreezeAt: slip.autoFreezeAt,
    createdAt: slip.createdAt,
    stakeMinor: slip.stakeMinor,
    totalOdds: slip.totalOdds,
    potentialReturnMinor: slip.potentialReturnMinor,
    entryCount: slip.entryCount,
    paidCount: slip.paidCount,
    entries: slip.entries.map(entry => ({
      id: entry.id,
      phoneMasked: entry.phoneMasked,
      stakeMinor: entry.stakeMinor,
      status: entry.status,
      ticketId: entry.ticketId,
      ticketCode: entry.ticketCode,
      failureReason: entry.failureReason,
      paidAt: entry.paidAt,
      createdAt: entry.createdAt,
    })),
    selections: slip.selections.map(selection => ({
      fixtureLabel: selection.fixtureLabel,
      marketName: selection.marketName,
      selectionLabel: selection.selectionLabel,
      odds: selection.odds,
    })),
  }))

  return (
    <PageShell
      eyebrow="Admin"
      title="Bet control"
      intro="Switch the platform between live and sandbox, review the model's best upcoming picks, set the odds and stake you want to offer, then freeze a slip the moment you need to."
    >
      <AdminNav active="/admin/bets" />

      <AdminBetModeToggle mode={mode} />

      {!harakapayApiKeyConfigured() ? (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200">
          HarakaPay is not loaded on this server, so live card and mobile-money payments will
          return a configuration error. Add <code className="font-mono">HARAKAPAY_API_KEY</code> to
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
          Slips freeze automatically when their first match kicks off. You can also freeze or reopen
          any open slip manually.
        </p>
      </section>

      <AdminSlipList slips={slipItems} />
    </PageShell>
  )
}

export const instant = false