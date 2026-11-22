'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { MARKET_GROUPS, type BetEvent, type BetMarket, type BetMarketGroup } from '@/lib/bet/types'
import { OddsButton } from './odds-button'

type MarketTab = 'all' | BetMarketGroup

const MARKET_TABS: Array<{ id: MarketTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'popular', label: 'Popular' },
  { id: 'goals', label: 'Goals' },
  { id: 'halves', label: 'Halves' },
]

export function MarketAccordion({
  event,
  markets,
  title = 'Markets',
  compact = false,
}: {
  event: BetEvent
  markets?: BetMarket[]
  title?: string
  compact?: boolean
}) {
  const availableMarkets = markets ?? event.markets
  const [tab, setTab] = useState<MarketTab>('all')
  const [open, setOpen] = useState(true)

  const visibleMarkets = useMemo(
    () => availableMarkets.filter(market => tab === 'all' || MARKET_GROUPS[market.id] === tab),
    [availableMarkets, tab],
  )

  const totalSelections = availableMarkets.reduce(
    (total, market) => total + market.selections.length,
    0,
  )

  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-surface/70 ${
        compact ? 'p-2.5' : 'p-3 sm:p-4'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11px] font-semibold text-main-text">{title}</span>
          <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-accent">
            {totalSelections}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-text transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="mt-2 border-t border-border/70 pt-2">
          <div
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Market groups"
          >
            {MARKET_TABS.map(item => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
                    active
                      ? 'bg-accent text-background'
                      : 'bg-background/60 text-muted-text hover:text-main-text'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div
            className={`mt-2 space-y-2 overflow-y-auto pr-1 ${
              compact ? 'max-h-56' : 'max-h-[28rem]'
            }`}
          >
            {visibleMarkets.map(market => (
              <div key={market.id} className="min-w-0 rounded-xl bg-background/30 p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-main-text">
                    {market.name}
                  </span>
                  <span className="shrink-0 text-[9px] text-muted-text">
                    {market.selections.length} selections
                  </span>
                </div>
                <div
                  className={`grid gap-1.5 ${
                    compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                  }`}
                >
                  {market.selections.map(selection => (
                    <OddsButton key={selection.id} event={event} selection={selection} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
