import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Search, SlidersHorizontal } from 'lucide-react'
import { EventGrid } from '@/components/bet/event-grid'
import { SectionHeading } from '@/components/bet/section-heading'
import { getBetCatalog } from '@/lib/bet/catalog'

export const metadata: Metadata = {
  title: 'Sports',
  description: 'Browse live and upcoming fixtures with transparent simulated odds.',
}

type SearchParams = Promise<{
  q?: string
  sport?: string
  day?: string
  status?: string
}>

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export default async function BetSportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await connection()
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const sport = params.sport ?? ''
  const day = params.day ?? 'all'
  const status = params.status ?? 'all'

  const catalog = await getBetCatalog()
  const today = startOfUtcDay(new Date())
  const dayMs = 24 * 60 * 60 * 1000

  const sports = [...new Map(catalog.events.map(event => [event.sportId, event.sport])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const events = catalog.events.filter(event => {
    if (sport && event.sportId !== sport) return false
    if (status === 'live' && !event.live) return false
    if (status === 'upcoming' && event.effectiveStatus !== 'SCHEDULED') return false
    if (status === 'finished' && event.effectiveStatus !== 'FINISHED') return false

    if (day !== 'all') {
      const kickoff = new Date(event.kickoffIso).getTime()
      if (day === 'today' && (kickoff < today || kickoff >= today + dayMs)) return false
      if (day === 'tomorrow' && (kickoff < today + dayMs || kickoff >= today + 2 * dayMs)) return false
      if (day === 'week' && (kickoff < today || kickoff >= today + 7 * dayMs)) return false
    }

    if (q) {
      const haystack = `${event.home.name} ${event.away.name} ${event.competition}`.toLowerCase()
      if (!haystack.includes(q.toLowerCase())) return false
    }

    return true
  })

  const activeFilters = Boolean(q || sport || day !== 'all' || status !== 'all')

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Sportsbook"
        title="All fixtures"
        description="Simulated prices from the Predisha model. Pick one selection per market."
        action="Live only"
        actionHref="/bet/live"
      />

      <form
        action="/bet/sports"
        className="rounded-2xl border border-border bg-surface/80 p-4"
      >
        <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Search fixtures</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search team or competition"
              className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-text/70 focus:border-accent/60"
            />
          </label>

          <label>
            <span className="sr-only">Sport</span>
            <select
              name="sport"
              defaultValue={sport}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
            >
              <option value="">All sports</option>
              {sports.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Day</span>
            <select
              name="day"
              defaultValue={day}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
            >
              <option value="all">Any day</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">Next 7 days</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
            >
              <option value="all">All statuses</option>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
              <option value="finished">Finished</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Apply
          </button>
        </div>

        {activeFilters ? (
          <div className="mt-3">
            <Link href="/bet/sports" className="text-xs font-semibold text-accent hover:underline">
              Clear filters
            </Link>
          </div>
        ) : null}
      </form>

      <div className="flex items-center justify-between text-xs text-muted-text">
        <span>
          {events.length} fixture{events.length === 1 ? '' : 's'}
        </span>
        <span>{catalog.providerMessage}</span>
      </div>

      <EventGrid events={events} />
    </div>
  )
}

export const instant = false
