'use client'

import { Lock } from 'lucide-react'
import { formatOdds } from '@/lib/bet/format'
import type { BetEvent, BetSelectionOption, BetSlipItem } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

const TERMINAL_STATUSES = new Set(['FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED'])

export function OddsButton({
  event,
  selection,
}: {
  event: BetEvent
  selection: BetSelectionOption
}) {
  const { hasSelection, toggleSelection, locked } = useBetSlip()

  const closed = TERMINAL_STATUSES.has(event.effectiveStatus)
  const disabled = closed || locked

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
  const title = locked
    ? 'This shared slip cannot be changed'
    : closed
      ? 'Betting is closed for this fixture'
      : `${selection.marketName}: ${selection.label}`

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) toggleSelection(item)
      }}
      disabled={disabled}
      aria-disabled={disabled}
      aria-pressed={selected}
      title={title}
      className={`group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-colors ${
        selected
          ? 'border-accent bg-accent text-background'
          : 'border-border bg-background/40 text-main-text hover:border-accent/50 hover:bg-accent/10'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${
        locked ? 'ring-1 ring-inset ring-amber-400/50' : ''
      }`}
    >
      <span
        className={`flex max-w-full items-center justify-center gap-0.5 text-[11px] font-bold ${
          selected ? 'text-background/70' : 'text-muted-text'
        }`}
      >
        {locked ? <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" /> : null}
        <span className="truncate">{selection.label}</span>
      </span>
      <span className="text-sm font-bold tabular-nums">{formatOdds(selection.odds)}</span>
    </button>
  )
}
