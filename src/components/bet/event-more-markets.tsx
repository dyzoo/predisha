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
    <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-xl border border-border/80 bg-background/30">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-muted-text transition-colors hover:text-main-text"
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
        <div className="min-w-0 border-t border-border/70 p-2.5">
          <label className="block sm:hidden">
            <span className="sr-only">Choose a market</span>
            <select
              value={activeMarket.id}
              onChange={event => setActiveId(event.target.value as BetMarketId)}
              className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] font-semibold text-main-text outline-none focus:border-accent/60"
            >
              {extras.map(market => (
                <option key={market.id} value={market.id}>
                  {market.name}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden flex-wrap gap-1 sm:flex">
            {extras.map(market => (
              <button
                key={market.id}
                type="button"
                onClick={() => setActiveId(market.id)}
                aria-pressed={activeMarket.id === market.id}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
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
