import type { Metadata } from 'next'
import { connection } from 'next/server'
import { SectionHeading } from '@/components/bet/section-heading'
import {
  SportsbookBrowser,
  type SportsbookFilters,
} from '@/components/bet/sportsbook-browser'
import { getBetCatalog } from '@/lib/bet/catalog'

export const metadata: Metadata = {
  title: 'Sports',
  description: 'Browse live and upcoming fixtures.',
}

type SearchParams = Promise<{
  q?: string
  sport?: string
  day?: string
  status?: string
  page?: string
}>

export default async function BetSportsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection()
  const params = await searchParams
  const filters: SportsbookFilters = {
    q: (params.q ?? '').trim(),
    sport: params.sport ?? '',
    day: params.day ?? 'all',
    status: params.status ?? 'all',
  }
  const page = Math.max(1, Math.floor(Number(params.page) || 1))
  const catalog = await getBetCatalog()

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Sportsbook"
        title="All fixtures"
        description="Pick one selection per market."
        action="Live only"
        actionHref="/bet/live"
      />

      <SportsbookBrowser
        key={filters.q}
        basePath="/bet/sports"
        events={catalog.events}
        filters={filters}
        page={page}
        providerMessage={catalog.providerMessage}
        now={Date.parse(catalog.generatedAt)}
      />
    </div>
  )
}

export const instant = false
