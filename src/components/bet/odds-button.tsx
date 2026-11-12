'use client'

import { formatOdds } from '@/lib/bet/format'
import type { BetEvent, BetSelectionOption, BetSlipItem } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

export function OddsButton({
  event,
  selection,
}: {
  event: BetEvent
  selection: BetSelectionOption
}) {
  const { hasSelection, toggleSelection } = useBetSlip()

  const catalogTime = new Date(event.oddsAsOf).getTime()
  const kickoffPassed =
    event.status === 'SCHEDULED' &&
    new Date(event.kickoffIso).getTime() < catalogTime - 10 * 60 * 1000
  const closed =
    event.effectiveStatus === 'FINISHED' ||
    event.effectiveStatus === 'POSTPONED' ||
    event.effectiveStatus === 'CANCELLED' ||
    event.effectiveStatus === 'ABANDONED' ||
    kickoffPassed

  const item: BetSlipItem = {
    key: `${event.id}:${selection.marketId}:${selection.selectionId}`,
    fixtureId: event.id,
    marketId: selection.marketId,
    selectionId: selection.selectionId,
    odds: selection.odds,
    fixtureLabel: `${event.home.name} vs ${event.away.name}`,
    competition: event.competition,
    marketName: selection.marketName,
    selectionLabel: selection.label,
    kickoffIso: event.kickoffIso,
  }

  const selected = hasSelection(item.key)

  return (
    <button
      type="button"
      onClick={() => toggleSelection(item)}
      disabled={closed}
      aria-pressed={selected}
      title={closed ? 'Betting is closed for this fixture' : `${selection.marketName}: ${selection.label}`}
      className={`group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-colors ${
        selected
          ? 'border-accent bg-accent text-background'
          : 'border-border bg-background/40 text-main-text hover:border-accent/50 hover:bg-accent/10'
      } ${closed ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className={`max-w-full truncate text-[10px] font-medium ${
          selected ? 'text-background/70' : 'text-muted-text'
        }`}
      >
        {selection.shortLabel}
      </span>
      <span className="text-sm font-bold tabular-nums">{formatOdds(selection.odds)}</span>
    </button>
  )
}
