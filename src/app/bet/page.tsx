import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowRight, Gamepad2, Radio } from 'lucide-react'
import { GameCard } from '@/components/bet/game-card'
import { BET_GAMES } from '@/components/bet/games-catalog'
import { SectionHeading } from '@/components/bet/section-heading'
import {
  SportsbookBrowser,
  type SportsbookFilters,
} from '@/components/bet/sportsbook-browser'
import { getBetCatalog } from '@/lib/bet/catalog'
import { getBetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Sportsbook',
  description:
    'Browse live and upcoming fixtures, build a bet slip, deposit funds and place a bet.',
}

type SearchParams = Promise<{
  q?: string
  sport?: string
  day?: string
  status?: string
  page?: string
}>

export default async function BetHomePage({ searchParams }: { searchParams: SearchParams }) {
  await connection()
  const params = await searchParams
  const filters: SportsbookFilters = {
    q: (params.q ?? '').trim(),
    sport: params.sport ?? '',
    day: params.day ?? 'all',
    status: params.status ?? 'all',
  }
  const page = Math.max(1, Math.floor(Number(params.page) || 1))
  const [catalog, mode] = await Promise.all([getBetCatalog(), getBetMode()])
  const now = Date.parse(catalog.generatedAt)
  const live = catalog.events.filter(event => event.live)
  const upcoming = catalog.events.filter(event => event.effectiveStatus === 'SCHEDULED')

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Sportsbook
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Live and upcoming matches
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-text">
            Browse every fixture, tap a price to add it to your bet slip, then place your bet when
            you are ready.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-red-300">
              <Radio className="h-3 w-3" />
              {live.length} live
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-muted-text">
              {upcoming.length} upcoming
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bet/live"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:border-accent/40"
          >
            <Radio className="h-4 w-4 text-accent" />
            Live now
          </Link>
          <Link
            href="/bet/games"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:border-accent/40"
          >
            <Gamepad2 className="h-4 w-4 text-accent" />
            Games
          </Link>
        </div>
      </section>

      {!catalog.providerOk ? (
        <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted-text">
          <span className="font-semibold text-main-text">Fixture feed:</span>{' '}
          {catalog.providerMessage}
        </div>
      ) : null}

      <SportsbookBrowser
        key={filters.q}
        basePath="/bet"
        events={catalog.events}
        filters={filters}
        page={page}
        providerMessage={catalog.providerOk ? catalog.providerMessage : undefined}
        now={now}
      />

      <section>
        <SectionHeading
          eyebrow="Arcade"
          title="Games"
          description="Fast rounds with server-side randomness and betting wallet stakes."
          action="All games"
          actionHref="/bet/games"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BET_GAMES.slice(0, 3).map(game => (
            <GameCard key={game.href} game={game} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-accent/20 bg-accent/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Promo
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              {mode === 'SANDBOX' ? 'Claim play-money credit' : 'Claim bonus credit'}
            </h2>
            <p className="mt-1 text-sm text-muted-text">
              New and existing accounts can claim play-money bonuses. No deposit or card is
              required.
            </p>
          </div>
          <Link
            href="/bet/promo"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-background"
          >
            View promos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}

export const instant = false
