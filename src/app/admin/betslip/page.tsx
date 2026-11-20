import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminNav } from '@/components/admin/admin-nav'
import { AdminShell } from '@/components/admin/admin-shell'
import { BetSlipStudio } from '@/components/admin/bet-slip-studio/bet-slip-studio'
import type { FixtureOption, SharedSlipOption } from '@/components/admin/bet-slip-studio/model'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { getBetCatalog } from '@/lib/bet/catalog'
import { formatKickoffLabel } from '@/lib/bet/format'
import { listSlipDesigns } from '@/lib/bet/slip-designs'
import { listAdminBetSlips } from '@/lib/bet/slips'

export const metadata: Metadata = {
  title: 'Admin bet slip studio',
}

export default async function AdminBetSlipPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <AdminShell eyebrow="Admin" title="Bet slip studio">
        <AdminAccessState status="unconfigured" />
      </AdminShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/betslip')
  if (!canViewAdmin(viewer)) {
    return (
      <AdminShell eyebrow="Admin" title="Bet slip studio">
        <AdminAccessState status="forbidden" />
      </AdminShell>
    )
  }

  const [catalog, slips, designs] = await Promise.all([
    getBetCatalog(),
    listAdminBetSlips(),
    listSlipDesigns(),
  ])

  const fixtures: FixtureOption[] = catalog.events.slice(0, 120).map(event => ({
    id: event.id,
    label: `${event.home.name} vs ${event.away.name}`,
    home: event.home.name,
    away: event.away.name,
    competition: event.competition,
    kickoffIso: event.kickoffIso,
    kickoffLabel: event.kickoffLabel,
    status: event.effectiveStatus,
    markets: event.markets.slice(0, 8).map(market => ({
      id: market.id,
      name: market.name,
      picks: market.selections.slice(0, 6).map(selection => ({
        id: `${market.id}:${selection.selectionId}`,
        marketId: market.id,
        selectionId: selection.selectionId,
        label: selection.label,
        odds: selection.odds,
      })),
    })),
  }))

  const sharedSlips: SharedSlipOption[] = slips
    .filter(slip => slip.status === 'OPEN' || slip.status === 'FROZEN')
    .map(slip => ({
      id: slip.id,
      code: slip.code,
      title: slip.title,
      status: slip.status,
      totalOdds: slip.totalOdds,
      stakeMinor: slip.stakeMinor,
      selectionCount: slip.selections.length,
      selections: slip.selections.map(selection => ({
        fixtureLabel: selection.fixtureLabel,
        marketName: selection.marketName,
        selectionLabel: selection.selectionLabel,
        odds: selection.odds,
        kickoffLabel: selection.kickoffIso ? formatKickoffLabel(selection.kickoffIso) : null,
        competition: selection.competition ?? null,
      })),
    }))

  return (
    <AdminShell
      eyebrow="Admin"
      title="Bet slip studio"
      intro="Build a styled bet slip from system fixtures, active shared slips or your own rows. Save it to reopen and edit later, mark it won to add winning ticks, then download a clean PNG."
    >
      <AdminNav active="/admin/betslip" />
      <BetSlipStudio fixtures={fixtures} sharedSlips={sharedSlips} savedSlips={designs} />
    </AdminShell>
  )
}

export const instant = false
