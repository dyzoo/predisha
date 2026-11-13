import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Receipt, SlidersHorizontal } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminBetModeToggle } from '@/components/admin/admin-bet-mode-toggle'
import { AdminSlipGenerator, type GeneratorEvent } from '@/components/admin/admin-slip-generator'
import { AdminSlipList, type AdminSlipListItemView } from '@/components/admin/admin-slip-list'
import { AdminNav } from '@/components/admin/admin-nav'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { getBetCatalog } from '@/lib/bet/catalog'
import { getBetMode } from '@/lib/bet/mode'
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

  const [mode, catalog, slips] = await Promise.all([
    getBetMode(),
    getBetCatalog(),
    listAdminBetSlips(),
  ])

  const events: GeneratorEvent[] = catalog.events
    .filter(event => event.effectiveStatus === 'SCHEDULED' || event.effectiveStatus === 'LIVE')
    .slice(0, 40)
    .map(event => ({
      id: event.id,
      label: `${event.home.name} vs ${event.away.name} · ${event.competition} · ${event.kickoffLabel}`,
      kickoffLabel: event.kickoffLabel,
      status: event.effectiveStatus,
      markets: event.markets.map(market => ({
        id: market.id,
        name: market.name,
        selections: market.selections.map(selection => ({
          selectionId: selection.selectionId,
          label: selection.label,
          odds: selection.odds,
        })),
      })),
    }))

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
      intro="Switch the platform between live and sandbox, build shareable bet slips with your own stake and odds, and freeze a slip the moment you need to."
    >
      <AdminNav active="/admin/bets" />

      <AdminBetModeToggle mode={mode} />

      <AdminSlipGenerator events={events} />

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