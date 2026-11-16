import type { BetEvent } from '@/lib/bet/types'
import { OddsButton } from './odds-button'

export function MarketPanel({ event }: { event: BetEvent }) {
  return (
    <div className="space-y-4">
      {event.markets.map(market => (
        <section
          key={market.id}
          className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface/80 p-4"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 truncate text-sm font-semibold">{market.name}</h3>
            <span className="shrink-0 text-[10px] text-muted-text">
              {market.id === '1x2' ? 'Match odds' : 'More markets'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {market.selections.map(selection => (
              <OddsButton key={selection.id} event={event} selection={selection} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
