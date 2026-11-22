import type { BetEvent } from '@/lib/bet/types'
import { MarketAccordion } from './market-accordion'

export function MarketPanel({ event }: { event: BetEvent }) {
  return <MarketAccordion event={event} title="All markets" />
}
