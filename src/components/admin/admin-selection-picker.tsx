'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  Plus,
  Search,
  Trophy,
} from 'lucide-react'
import type { AdminRecommendationPick } from '@/lib/bet/recommendation'
import { formatOdds } from '@/lib/bet/format'
import type { BetEvent } from '@/lib/bet/types'

interface CatalogResponse {
  events?: BetEvent[]
  error?: string
}

function pickFromSelection(
  event: BetEvent,
  market: BetEvent['markets'][number],
  selection: BetEvent['markets'][number]['selections'][number],
): AdminRecommendationPick {
  return {
    fixtureId: event.id,
    fixtureLabel: `${event.home.name} vs ${event.away.name}`,
    competition: event.competition,
    kickoffLabel: event.kickoffLabel,
    kickoffIso: event.kickoffIso,
    marketId: market.id,
    marketName: market.name,
    selectionId: selection.selectionId,
    selectionLabel: selection.label,
    odds: selection.odds,
    probability: selection.probability,
    riskLevel: selection.probability >= 0.6 ? 'low' : selection.probability >= 0.4 ? 'balanced' : 'high',
  }
}

export function AdminSelectionPicker({
  excludedFixtures,
  onAdd,
  disabled = false,
}: {
  excludedFixtures: Set<string>
  onAdd: (pick: AdminRecommendationPick) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<BetEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function loadCatalog() {
    if (loading) return
    if (events) {
      setOpen(current => !current)
      return
    }
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/bet/catalog', { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as CatalogResponse
      if (!response.ok || !payload.events) {
        setError(payload.error ?? 'Could not load the match catalog.')
        return
      }
      setEvents(payload.events)
    } catch {
      setError('Network error while loading the match catalog.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const source = events ?? []
    const now = Date.now()
    const needle = query.trim().toLowerCase()
    return source
      .filter(event => event.effectiveStatus === 'SCHEDULED' && new Date(event.kickoffIso).getTime() > now)
      .filter(event => {
        if (!needle) return true
        return [
          event.home.name,
          event.away.name,
          event.competition,
          ...event.markets.flatMap(market => [
            market.name,
            ...market.selections.map(selection => selection.label),
          ]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .slice(0, 40)
  }, [events, query])

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40">
      <button
        type="button"
        onClick={loadCatalog}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-semibold text-main-text transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-accent" />
          Add another match
        </span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {open ? (
        <div className="border-t border-border p-3">
          {error ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-200">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 focus-within:border-accent/60">
            <Search className="h-3.5 w-3.5 text-muted-text" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search team, league or market"
              className="w-full bg-transparent text-[11px] text-main-text outline-none placeholder:text-muted-text/70"
            />
          </label>

          <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {!loading && filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[11px] text-muted-text">
                No upcoming matches match that search.
              </p>
            ) : null}

            {filtered.map(event => {
              const added = excludedFixtures.has(event.id)
              const isOpen = expanded === event.id
              return (
                <div key={event.id} className="rounded-lg border border-border bg-surface/60">
                  <button
                    type="button"
                    onClick={() => setExpanded(current => (current === event.id ? null : event.id))}
                    className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-main-text">
                        {event.home.name} vs {event.away.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-text">
                        {event.competition} | {event.kickoffLabel}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {added ? (
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                          Added
                        </span>
                      ) : null}
                      {isOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-text" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-text" />
                      )}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-border p-2">
                      {added ? (
                        <p className="px-1 py-1 text-[10px] text-muted-text">
                          One selection per match. Remove the existing pick to swap it.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {event.markets.map(market => (
                            <div key={market.id}>
                              <p className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                                <Trophy className="h-3 w-3" />
                                {market.name}
                              </p>
                              <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                                {market.selections.map(selection => (
                                  <button
                                    key={selection.selectionId}
                                    type="button"
                                    onClick={() => onAdd(pickFromSelection(event, market, selection))}
                                    className="flex items-center justify-between gap-1 rounded-md border border-border bg-background/60 px-2 py-1.5 text-left text-[10px] text-main-text transition-colors hover:border-accent/50 hover:text-accent"
                                  >
                                    <span className="truncate">{selection.label}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-accent">
                                      {formatOdds(selection.odds)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
