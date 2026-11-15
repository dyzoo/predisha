import Link from 'next/link'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { BetEvent } from '@/lib/bet/types'
import { EventGrid } from './event-grid'

export interface SportsbookFilters {
  q: string
  sport: string
  day: string
  status: string
}

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function startOfEatDay(date: Date): number {
  const shifted = new Date(date.getTime() + EAT_OFFSET_MS)
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - EAT_OFFSET_MS
  )
}

function hrefWithFilters(
  basePath: string,
  filters: SportsbookFilters,
  patch: Partial<SportsbookFilters>,
): string {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.sport) params.set('sport', next.sport)
  if (next.day !== 'all') params.set('day', next.day)
  if (next.status !== 'all') params.set('status', next.status)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function SportsbookBrowser({
  basePath,
  events,
  filters,
  providerMessage,
}: {
  basePath: string
  events: BetEvent[]
  filters: SportsbookFilters
  providerMessage?: string
}) {
  const sportsById = new Map<string, { id: string; name: string; count: number }>()
  for (const event of events) {
    const sport = sportsById.get(event.sportId)
    if (sport) sport.count += 1
    else sportsById.set(event.sportId, { id: event.sportId, name: event.sport, count: 1 })
  }
  const sports = [...sportsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )

  const today = startOfEatDay(new Date())
  const filtered = events.filter(event => {
    if (filters.sport && event.sportId !== filters.sport) return false
    if (filters.status === 'live' && !event.live) return false
    if (filters.status === 'upcoming' && event.effectiveStatus !== 'SCHEDULED') return false
    if (filters.status === 'finished' && event.effectiveStatus !== 'FINISHED') return false

    if (filters.day !== 'all') {
      const kickoff = new Date(event.kickoffIso).getTime()
      if (filters.day === 'today' && (kickoff < today || kickoff >= today + DAY_MS)) return false
      if (filters.day === 'tomorrow' && (kickoff < today + DAY_MS || kickoff >= today + 2 * DAY_MS)) {
        return false
      }
      if (filters.day === 'week' && (kickoff < today || kickoff >= today + 7 * DAY_MS)) return false
    }

    if (filters.q) {
      const haystack = `${event.home.name} ${event.away.name} ${event.competition}`.toLowerCase()
      if (!haystack.includes(filters.q.toLowerCase())) return false
    }

    return true
  })

  const activeFilters = Boolean(
    filters.q || filters.sport || filters.day !== 'all' || filters.status !== 'all',
  )

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link
          href={hrefWithFilters(basePath, filters, { sport: '' })}
          aria-current={filters.sport ? undefined : 'page'}
          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            filters.sport
              ? 'border border-border bg-surface text-muted-text hover:border-accent/40 hover:text-main-text'
              : 'bg-accent text-background'
          }`}
        >
          All sports
          <span className="text-[10px] opacity-70">{events.length}</span>
        </Link>
        {sports.map(sport => (
          <Link
            key={sport.id}
            href={hrefWithFilters(basePath, filters, { sport: sport.id })}
            aria-current={filters.sport === sport.id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filters.sport === sport.id
                ? 'bg-accent text-background'
                : 'border border-border bg-surface text-muted-text hover:border-accent/40 hover:text-main-text'
            }`}
          >
            {sport.name}
            <span className="text-[10px] opacity-70">{sport.count}</span>
          </Link>
        ))}
      </div>

      <form action={basePath} className="rounded-2xl border border-border bg-surface/80 p-3 sm:p-4">
        <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Search fixtures</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search team or competition"
              className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-text/70 focus:border-accent/60"
            />
          </label>

          <label>
            <span className="sr-only">Sport</span>
            <select
              name="sport"
              defaultValue={filters.sport}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
            >
              <option value="">All sports</option>
              {sports.map(sport => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Day</span>
            <select
              name="day"
              defaultValue={filters.day}
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
              defaultValue={filters.status}
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
            <Link href={basePath} className="text-xs font-semibold text-accent hover:underline">
              Clear filters
            </Link>
          </div>
        ) : null}
      </form>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-text">
        <span>
          {filtered.length} fixture{filtered.length === 1 ? '' : 's'}
        </span>
        {providerMessage ? (
          <span className="max-w-[60%] truncate text-right">{providerMessage}</span>
        ) : null}
      </div>

      <EventGrid
        events={filtered}
        emptyTitle="No fixtures match those filters"
        emptyMessage="Try another sport, day or search term."
      />
    </div>
  )
}
