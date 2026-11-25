'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { statusLabel } from '@/lib/bet/format'
import { matchesBetEventQuery, searchBetEvents } from '@/lib/bet/search'
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
const PAGE_SIZE = 9

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
  page = 1,
): string {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.sport) params.set('sport', next.sport)
  if (next.day !== 'all') params.set('day', next.day)
  if (next.status !== 'all') params.set('status', next.status)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function paginationItems(currentPage: number, totalPages: number): Array<number | 'gap'> {
  const numbers = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter(page => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)
  const items: Array<number | 'gap'> = []
  for (const [index, page] of numbers.entries()) {
    const previous = numbers[index - 1]
    if (previous !== undefined && page - previous > 1) items.push('gap')
    items.push(page)
  }
  return items
}

export function SportsbookBrowser({
  basePath,
  events,
  filters,
  page = 1,
  providerMessage,
  now,
}: {
  basePath: string
  events: BetEvent[]
  filters: SportsbookFilters
  page?: number
  providerMessage?: string
  now: number
}) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.q)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const sportsById = new Map<string, { id: string; name: string; count: number }>()
  for (const event of events) {
    const sport = sportsById.get(event.sportId)
    if (sport) sport.count += 1
    else sportsById.set(event.sportId, { id: event.sportId, name: event.sport, count: 1 })
  }
  const sports = [...sportsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )

  const today = startOfEatDay(new Date(now))
  const matchesOtherFilters = (event: BetEvent) => {
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

    return true
  }

  const eligibleEvents = events.filter(matchesOtherFilters)
  const filtered = eligibleEvents.filter(event => matchesBetEventQuery(event, filters.q))
  const suggestions = searchBetEvents(eligibleEvents, query, 6)

  const activeFilters = Boolean(
    filters.q || filters.sport || filters.day !== 'all' || filters.status !== 'all',
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, filtered.length)
  const pageEvents = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const pageLinks = paginationItems(currentPage, totalPages)

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

      <form
        action={basePath}
        onSubmit={event => {
          event.preventDefault()
          setShowSuggestions(false)
          router.push(hrefWithFilters(basePath, filters, { q: query.trim() }, 1))
        }}
        className="rounded-2xl border border-border bg-surface/80 p-3 sm:p-4"
      >
        <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <label className="relative block">
              <span className="sr-only">Search fixtures</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                name="q"
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                autoComplete="off"
                role="combobox"
                placeholder="Search team or match"
                aria-label="Search team or match"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="fixture-search-suggestions"
                className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-muted-text/70 focus:border-accent/60"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    setShowSuggestions(false)
                    router.push(hrefWithFilters(basePath, filters, { q: '' }, 1))
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-text transition-colors hover:bg-background/60 hover:text-main-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>

            {showSuggestions && suggestions.length > 0 ? (
              <div
                id="fixture-search-suggestions"
                className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
              >
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                  Matching fixtures
                </p>
                {suggestions.map(event => (
                  <Link
                    key={event.id}
                    href={`/bet/match/${event.id}`}
                    onMouseDown={mouseEvent => mouseEvent.preventDefault()}
                    onClick={() => setShowSuggestions(false)}
                    className="block rounded-xl px-2 py-2 transition-colors hover:bg-background/60"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {event.home.name} <span className="text-muted-text">vs</span> {event.away.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-accent">
                        Stats & markets
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-text">
                      {event.competition} · {event.kickoffLabel} · {statusLabel(event.effectiveStatus)}
                    </span>
                  </Link>
                ))}
                <Link
                  href={hrefWithFilters(basePath, filters, { q: query.trim() }, 1)}
                  onMouseDown={mouseEvent => mouseEvent.preventDefault()}
                  onClick={() => setShowSuggestions(false)}
                  className="mt-1 block rounded-xl border-t border-border px-2 py-2 text-[11px] font-semibold text-accent transition-colors hover:bg-background/60"
                >
                  See all results for “{query.trim()}”
                </Link>
              </div>
            ) : null}
          </div>

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
            <Link
              href={basePath}
              onClick={() => {
                setQuery('')
                setShowSuggestions(false)
              }}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Clear filters
            </Link>
          </div>
        ) : null}
      </form>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-text">
        <span>
          {filtered.length === 0
            ? '0 fixtures'
            : `Showing ${startIndex + 1}-${endIndex} of ${filtered.length} fixtures`}
        </span>
        {providerMessage ? (
          <span className="max-w-[60%] truncate text-right">{providerMessage}</span>
        ) : null}
      </div>

      <EventGrid
        events={pageEvents}
        emptyTitle={
          filters.q ? `No fixtures found for “${filters.q}”` : 'No fixtures match those filters'
        }
        emptyMessage={
          filters.q
            ? 'Check the spelling or try a team name, match or competition.'
            : 'Try another sport, day or search term.'
        }
      />

      {totalPages > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-center gap-1 border-t border-border pt-4"
          aria-label="Fixture pagination"
        >
          {currentPage > 1 ? (
            <Link
              href={hrefWithFilters(basePath, filters, {}, currentPage - 1)}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-main-text"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface/40 px-3 text-xs font-semibold text-muted-text/40">
              Previous
            </span>
          )}

          {pageLinks.map((item, index) =>
            item === 'gap' ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-xs font-semibold text-muted-text/60"
              >
                ...
              </span>
            ) : (
              <Link
                key={item}
                href={hrefWithFilters(basePath, filters, {}, item)}
                aria-current={item === currentPage ? 'page' : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  item === currentPage
                    ? 'border-accent bg-accent text-background'
                    : 'border-border bg-surface text-muted-text hover:border-accent/40 hover:text-main-text'
                }`}
              >
                {item}
              </Link>
            ),
          )}

          {currentPage < totalPages ? (
            <Link
              href={hrefWithFilters(basePath, filters, {}, currentPage + 1)}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-main-text"
            >
              Next
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface/40 px-3 text-xs font-semibold text-muted-text/40">
              Next
            </span>
          )}
        </nav>
      ) : null}
    </div>
  )
}
