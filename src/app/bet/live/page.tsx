import type { Metadata } from 'next'
import { connection } from 'next/server'
import { EventGrid } from '@/components/bet/event-grid'
import { LiveSlipDetails } from '@/components/bet/live-slip-details'
import { SectionHeading } from '@/components/bet/section-heading'
import { getBetCatalog } from '@/lib/bet/catalog'
import { getAdminBetSlipByCode, type AdminBetSlipView } from '@/lib/bet/slips'

export const metadata: Metadata = {
  title: 'Live',
  description: 'In-play fixtures with server-side settlement.',
}

export default async function BetLivePage({
  searchParams,
}: {
  searchParams: Promise<{ slip?: string | string[] }>
}) {
  await connection()
  const { slip: slipCode } = await searchParams
  const code = typeof slipCode === 'string' ? slipCode : null
  let slip: AdminBetSlipView | null = null
  if (code) {
    try {
      slip = await getAdminBetSlipByCode(code)
    } catch {
      slip = null
    }
  }
  const catalog = await getBetCatalog()
  const live = catalog.events.filter(event => event.live)

  return (
    <div className="space-y-6">
      {slip ? <LiveSlipDetails slip={slip} /> : null}
      <SectionHeading
        eyebrow="In play"
        title="Live fixtures"
        description="Scores come from the fixture feed. Prices are locked when you place a bet."
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
