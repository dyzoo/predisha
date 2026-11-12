import type { Metadata } from 'next'
import { connection } from 'next/server'
import { EventGrid } from '@/components/bet/event-grid'
import { SectionHeading } from '@/components/bet/section-heading'
import { getBetCatalog } from '@/lib/bet/catalog'

export const metadata: Metadata = {
  title: 'Live',
  description: 'In-play fixtures with simulated odds and server-side settlement.',
}

export default async function BetLivePage() {
  await connection()
  const catalog = await getBetCatalog()
  const live = catalog.events.filter(event => event.live)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="In play"
        title="Live fixtures"
        description="Scores come from the fixture feed. Prices are simulated and frozen when you place a bet."
        action="All sports"
        actionHref="/bet/sports"
      />
      <EventGrid
        events={live}
        emptyTitle="No live fixtures right now"
        emptyMessage="Check the upcoming list or open the arcade while you wait."
      />
    </div>
  )
}

export const instant = false
