import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowRight, Scale, ShieldCheck, Wallet } from 'lucide-react'
import { EventGrid } from '@/components/bet/event-grid'
import { GameCard } from '@/components/bet/game-card'
import { BET_GAMES } from '@/components/bet/games-catalog'
import { SectionHeading } from '@/components/bet/section-heading'
import { getBetCatalog } from '@/lib/bet/catalog'
import { getBetMode, type BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'PredishaBet · sportsbook',
  description:
    'Browse live and upcoming fixtures with transparent simulated odds, build a bet slip, deposit funds and place a bet.',
}

export default async function BetHomePage() {
  await connection()
  const catalog = await getBetCatalog()
  const mode: BetMode = await getBetMode()
  const live = catalog.events.filter(event => event.live)
  const upcoming = catalog.events
    .filter(event => event.effectiveStatus === 'SCHEDULED')
    .slice(0, 6)
  const marketCount = catalog.events.reduce(
    (total, event) => total + event.markets.reduce((sum, market) => sum + market.selections.length, 0),
    0,
  )

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#1b2430] via-surface to-[#2a1b1f] p-6 sm:p-10">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Live sportsbook
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Model-implied odds.
            <br />
            <span className="text-accent">Betting stakes.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-text sm:text-base">
            PredishaBet turns the Predisha model into a transparent book. Every price is simulated,
            every settlement runs server-side, and wallet funding runs through HarakaPay.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/bet/sports"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-background"
            >
              Browse fixtures
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/bet/games"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/30 px-5 py-3 text-sm font-semibold text-main-text hover:border-accent/40"
            >
              Open the arcade
            </Link>
          </div>
        </div>

        <div className="relative mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            { label: 'Live fixtures', value: live.length },
            { label: 'Upcoming', value: upcoming.length },
            { label: 'Selections', value: marketCount },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-white/5 bg-background/40 p-3">
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-text">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!catalog.providerOk ? (
        <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted-text">
          <span className="font-semibold text-main-text">Fixture feed:</span>{' '}
          {catalog.providerMessage}
        </div>
      ) : null}

      {live.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="In play"
            title="Live now"
            description="Scores update from the fixture feed. Odds remain simulated."
            action="All live"
            actionHref="/bet/live"
          />
          <EventGrid events={live.slice(0, 6)} />
        </section>
      ) : null}

      <section>
        <SectionHeading
          eyebrow="Sportsbook"
          title="Upcoming fixtures"
          description="Tap a price to add it to your slip. One selection per market."
          action="All sports"
          actionHref="/bet/sports"
        />
        <EventGrid events={upcoming} />
      </section>

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

      <section>
        <SectionHeading
          eyebrow="Built differently"
          title="What makes this book safer"
          description="The original paribet flow exposed payment PINs and trusted client-supplied odds. This workspace removes both."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'No payment collection',
              body: 'Deposits run through HarakaPay mobile-money prompts. No card processor or mobile-money PIN is stored.',
            },
            {
              icon: Scale,
              title: 'Odds you can audit',
              body: 'Prices come from the Predisha model with a published 6% margin. They are frozen per request and rechecked at placement.',
            },
            {
              icon: Wallet,
              title: 'Server-owned wallets',
              body: 'Balances, stakes, cash-outs and game rounds live in PostgreSQL behind authenticated, rate-limited endpoints.',
            },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.title} className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-text">{item.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-accent/20 bg-accent/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Promo
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{mode === 'SANDBOX' ? 'Claim play-money credit' : 'Claim bonus credit'}</h2>
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
