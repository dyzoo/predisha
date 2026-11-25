'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, Loader2, Plus, Search } from 'lucide-react'
import type { AdminRecommendationPick } from '@/lib/bet/recommendation'
import type { FixtureSuggestion } from '@/lib/bet/slip-reconciliation'

export type FixtureSearchPick = AdminRecommendationPick & { custom?: boolean }

interface SearchResponse {
  suggestions?: FixtureSuggestion[]
  error?: string
}

export function AdminFixtureSearch({
  excludedFixtures,
  onAdd,
  disabled = false,
}: {
  excludedFixtures: Set<string>
  onAdd: (pick: FixtureSearchPick) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<FixtureSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) return
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/admin/fixtures/search?q=${encodeURIComponent(needle)}`,
          { credentials: 'include', cache: 'no-store' },
        )
        const payload = (await response.json().catch(() => ({}))) as SearchResponse
        if (!response.ok || !payload.suggestions) {
          if (active) setError(payload.error ?? 'Could not search fixtures.')
          return
        }
        if (active) setSuggestions(payload.suggestions)
      } catch {
        if (active) setError('Network error while searching fixtures.')
      } finally {
        if (active) setLoading(false)
      }
    }, 260)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  function onQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setSuggestions([])
      setError(null)
      setLoading(false)
    }
  }

  function addFixture(suggestion: FixtureSuggestion) {
    onAdd({
      fixtureId: suggestion.fixtureId,
      fixtureLabel: suggestion.fixtureLabel,
      competition: suggestion.competition,
      kickoffIso: suggestion.kickoffIso,
      kickoffLabel: suggestion.kickoffLabel,
      marketId: '1x2',
      marketName: 'Match result',
      selectionId: 'HOME',
      selectionLabel: `${suggestion.home} win`,
      odds: 2,
      probability: 0.5,
      riskLevel: 'balanced',
      custom: true,
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 focus-within:border-accent/60">
        <Search className="h-3.5 w-3.5 text-muted-text" />
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          disabled={disabled}
          placeholder="Search teams from football-data.org"
          aria-label="Search teams from football-data.org"
          className="w-full bg-transparent text-[11px] text-main-text outline-none placeholder:text-muted-text/70 disabled:opacity-60"
        />
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : null}
      </label>

      {error ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-200">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {query.trim().length >= 2 && !loading && !error && suggestions.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-text">
          No live fixtures matched those teams.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {suggestions.map(suggestion => {
            const added = excludedFixtures.has(suggestion.fixtureId)
            return (
              <button
                key={suggestion.fixtureId}
                type="button"
                disabled={disabled || added}
                onClick={() => addFixture(suggestion)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 px-2.5 py-2 text-left transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-main-text">
                    {suggestion.fixtureLabel}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-text">
                    {suggestion.competition} · {suggestion.kickoffLabel}
                    {suggestion.live ? ' · LIVE' : ''}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-accent">
                  {added ? 'Added' : <><Plus className="h-3 w-3" /> Add</>}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
