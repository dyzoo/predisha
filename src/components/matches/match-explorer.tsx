'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search, TriangleAlert, X } from 'lucide-react'
import type { MatchView } from '@/lib/sports/view-model'
import { MatchCard } from '@/components/matches/match-card'

const PAGE_SIZE = 6

type StatusFilter = 'ALL' | 'UPCOMING' | 'LIVE' | 'FINISHED'

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'LIVE', label: 'Live' },
  { value: 'FINISHED', label: 'Finished' },
]

export function MatchExplorer({
  matches,
  competitions,
  isDemo,
  providerOk,
  providerMessage,
}: {
  matches: MatchView[]
  competitions: Array<{ id: string; name: string }>
  isDemo: boolean
  providerOk: boolean
  providerMessage: string
}) {
  const [query, setQuery] = useState('')
  const [competition, setCompetition] = useState('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return matches
      .filter(match => {
        if (competition !== 'ALL' && match.competitionId !== competition) return false
        if (status === 'UPCOMING' && match.effectiveStatus !== 'SCHEDULED') return false
        if (status === 'LIVE' && match.effectiveStatus !== 'LIVE') return false
        if (status === 'FINISHED' && match.effectiveStatus !== 'FINISHED') return false
        if (!normalized) return true
        return (
          match.home.name.toLowerCase().includes(normalized) ||
          match.away.name.toLowerCase().includes(normalized) ||
          match.competition.toLowerCase().includes(normalized)
        )
      })
      .sort((a, b) => {
        const rank = { LIVE: 0, SCHEDULED: 1, FINISHED: 2, POSTPONED: 3, CANCELLED: 4, ABANDONED: 5 }
        const statusDifference = rank[a.effectiveStatus] - rank[b.effectiveStatus]
        if (statusDifference !== 0) return statusDifference
        return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      })
  }, [competition, matches, query, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function updateFilter(update: () => void) {
    update()
    setPage(1)
  }

  const hasFilters = query.length > 0 || competition !== 'ALL' || status !== 'ALL'

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <CalendarDays className="h-3.5 w-3.5" />
            Fixtures
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Match centre
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-text sm:text-base">
            Filter by competition, status or team. Kickoff times are stored in UTC; timezone display
            is applied by the client. A probability is an estimate, never a guaranteed result.
          </p>
        </div>
        <p className="text-xs text-muted-text">
          {filtered.length} {filtered.length === 1 ? 'fixture' : 'fixtures'}
        </p>
      </div>

      {isDemo ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Demo data: fictional fixtures and illustrative probabilities for local development only.
            Not real forecasts.
          </p>
        </div>
      ) : null}

      {!providerOk ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs leading-relaxed text-red-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{providerMessage}</p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-surface/50 p-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search teams or competitions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
          <input
            type="search"
            value={query}
            onChange={event => updateFilter(() => setQuery(event.target.value))}
            placeholder="Search teams or competitions"
            className="w-full rounded-xl border border-border bg-background/60 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-text/70 focus:border-accent/60"
          />
        </label>

        <label className="block">
          <span className="sr-only">Competition</span>
          <select
            value={competition}
            onChange={event => updateFilter(() => setCompetition(event.target.value))}
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          >
            <option value="ALL">All competitions</option>
            {competitions.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Status</span>
          <select
            value={status}
            onChange={event => updateFilter(() => setStatus(event.target.value as StatusFilter))}
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() =>
            updateFilter(() => {
              setQuery('')
              setCompetition('ALL')
              setStatus('ALL')
            })
          }
          disabled={!hasFilters}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-text transition-colors hover:text-main-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      {visible.length > 0 ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(match => (
              <MatchCard key={match.id} match={match} isDemo={isDemo} />
            ))}
          </div>

          {pageCount > 1 ? (
            <nav
              className="mt-8 flex items-center justify-between gap-4"
              aria-label="Fixture pagination"
            >
              <button
                type="button"
                onClick={() => setPage(value => Math.max(1, value - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-text transition-colors hover:text-main-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-xs text-muted-text">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(value => Math.min(pageCount, value + 1))}
                disabled={safePage === pageCount}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-text transition-colors hover:text-main-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-text" />
          <p className="mt-3 text-base font-semibold">
            {matches.length === 0 ? 'No fixtures connected' : 'No matches fit these filters'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
            {matches.length === 0
              ? 'A production sports data provider is not configured, so no matches are shown. We never invent fixtures to fill the page.'
              : 'Try clearing the search or choosing another competition and status.'}
          </p>
        </div>
      )}
    </section>
  )
}
