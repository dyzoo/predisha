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
  const [openId, setOpenId] = useState<string | null>(availableMarkets[0]?.id ?? null)

  const visibleMarkets = useMemo(
    () =>
      availableMarkets.filter(market => tab === 'all' || MARKET_GROUPS[market.id] === tab),
    [availableMarkets, tab],
  )

  const expandedId = visibleMarkets.some(market => market.id === openId)
    ? openId
    : openId === null
      ? null
      : visibleMarkets[0]?.id ?? null

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
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h3 className="truncate text-[11px] font-semibold text-main-text">{title}</h3>
        <span className="shrink-0 text-[9px] text-muted-text">{totalSelections} selections</span>
      </div>

      <div
        className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      <div className="mt-2 space-y-2">
        {visibleMarkets.map(market => {
          const expanded = market.id === expandedId
          return (
            <div
              key={market.id}
              className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-background/30"
            >
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : market.id)}
                aria-expanded={expanded}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[11px] font-semibold text-main-text">
                    {market.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-accent">
                    {market.selections.length}
                  </span>
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-muted-text transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {expanded ? (
                <div
                  className={`overflow-y-auto border-t border-border/70 bg-background/70 p-2 ${
                    compact ? 'max-h-52' : 'max-h-72'
                  }`}
                >
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
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
