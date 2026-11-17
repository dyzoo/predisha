'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { EXTRA_MARKET_IDS, type BetEvent, type BetMarketId } from '@/lib/bet/types'
import { OddsButton } from './odds-button'

export function EventMoreMarkets({ event }: { event: BetEvent }) {
  const extras = event.markets.filter(market => EXTRA_MARKET_IDS.includes(market.id))
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<BetMarketId>(extras[0]?.id ?? 'double-chance')

  if (extras.length === 0) return null

  const activeMarket = extras.find(market => market.id === activeId) ?? extras[0]
  const extraSelectionCount = extras.reduce(
    (total, market) => total + market.selections.length,
    0,
  )

  return (
    <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/80 bg-background/30">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-t-2xl border border-border/80 bg-gradient-to-r from-surface/90 to-background/70 px-3 py-2 text-[11px] font-semibold text-main-text shadow-sm transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate">More markets</span>
          <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-accent">
            {extraSelectionCount}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="min-w-0 rounded-b-2xl border-t border-border/70 bg-background/80 p-3 shadow-xl">
          <label className="block sm:hidden">
            <span className="sr-only">Choose a market</span>
            <select
              value={activeMarket.id}
              onChange={event => setActiveId(event.target.value as BetMarketId)}
              className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-[11px] font-semibold text-main-text outline-none focus:border-accent/60"
            >
              {extras.map(market => (
                <option key={market.id} value={market.id}>
                  {market.name}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {extras.map(market => (
              <button
                key={market.id}
                type="button"
                onClick={() => setActiveId(market.id)}
                aria-pressed={activeMarket.id === market.id}
                className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                  activeMarket.id === market.id
                    ? 'bg-accent text-background'
                    : 'bg-background/60 text-muted-text hover:text-main-text'
                }`}
              >
                {market.name}
              </button>
            ))}
          </div>

          <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {activeMarket.selections.map(selection => (
              <OddsButton key={selection.id} event={event} selection={selection} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
