import Link from 'next/link'
import { ArrowUpRight, Radio, Search, TriangleAlert } from 'lucide-react'
import type { MatchView } from '@/lib/sports/view-model'
import { MatchCard } from '@/components/matches/match-card'
import { Reveal } from '@/components/ui/reveal'

export function MatchShowcase({ matches, isDemo }: { matches: MatchView[]; isDemo: boolean }) {
  return (
    <section id="matches" className="relative border-y border-border bg-surface/25 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <Radio className="h-3.5 w-3.5" />
              Featured fixtures
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              A short look at the board
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-text sm:text-base">
              Three fixtures to show how the model reads a match. Open the full list to browse
              everything, or build a complete prediction from the model-ranked picks.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              Build a prediction
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-elevated-surface"
            >
              All matches
            </Link>
          </div>
        </Reveal>

        {isDemo ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Demo data: these are fictional fixtures and illustrative probabilities shown for local
              development only. They are not real matches or forecasts.
            </p>
          </div>
        ) : null}

        {matches.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(match => (
              <MatchCard key={match.id} match={match} isDemo={isDemo} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-14 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-text" />
            <p className="mt-3 text-base font-semibold">No fixtures connected</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
              A production sports data provider is not configured yet, so no matches are shown. We
              never invent fixtures to fill the page.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
