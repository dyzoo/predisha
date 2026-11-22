'use client'

import type { BetEvent } from '@/lib/bet/types'
import { MarketAccordion } from './market-accordion'

export function EventMoreMarkets({ event }: { event: BetEvent }) {
  const markets = event.markets.filter(market => market.id !== '1x2')
  if (markets.length === 0) return null

  return <MarketAccordion event={event} markets={markets} title="More markets" compact />
}
