import type { BetEvent } from '@/lib/bet/types'
import { OddsButton } from './odds-button'

export function MarketPanel({ event }: { event: BetEvent }) {
  return (
    <div className="space-y-4">
      {event.markets.map(market => (
        <section key={market.id} className="rounded-2xl border border-border bg-surface/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{market.name}</h3>
            <span className="text-[10px] text-muted-text">Simulated</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {market.selections.map(selection => (
              <div key={selection.id} className="min-w-[92px] flex-1">
                <OddsButton event={event} selection={selection} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
