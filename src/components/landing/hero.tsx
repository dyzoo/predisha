'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { TeamBadge } from '@/components/teams/team-badge'
import type { MatchView } from '@/lib/sports/view-model'

interface HeroProps {
  featured?: MatchView
  isDemo?: boolean
}

const bullets = [
  { icon: ShieldCheck, label: 'Transparent inputs' },
  { icon: CalendarClock, label: 'Timestamped data' },
  { icon: Activity, label: 'Multi-market probabilities' },
]

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function Hero({ featured, isDemo = false }: HeroProps) {
  const reduceMotion = useReducedMotion()

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        animate: { opacity: 1, y: 0 },
      }

  return (
    <section className="relative overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1577223625816-7546f13df25d?q=80&w=2070&auto=format&fit=crop)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/80 via-background/60 to-background">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
        <div className="absolute -right-24 top-24 h-[360px] w-[360px] rounded-full bg-[#5B8CFF]/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-assisted football analytics
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.06, ease: 'easeOut' }}
            className="mt-5 max-w-2xl font-chivo text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Read the match
            <br />
            <span className="bg-gradient-to-r from-accent to-[#5B8CFF] bg-clip-text text-transparent">
            before kickoff.
          </span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.12, ease: 'easeOut' }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-text sm:text-lg"
          >
            Statistically grounded match probabilities, explained with the data behind them. Track
            fixtures, follow the model, and see the record honestly — no hype, no guaranteed wins.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/builder"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-background shadow-[0_10px_30px_-10px_rgba(200,255,67,0.7)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Build my prediction
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/matches"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-main-text transition-colors hover:border-white/20 hover:bg-elevated-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Explore matches
            </Link>
          </motion.div>

          <motion.ul
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.24, ease: 'easeOut' }}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-3"
          >
            {bullets.map(item => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-muted-text">
                <item.icon className="h-4 w-4 text-accent" />
                {item.label}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 32, rotate: -1 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.65, delay: 0.15, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="absolute -inset-3 -z-10 rounded-[28px] bg-gradient-to-br from-accent/20 via-transparent to-[#5B8CFF]/20 blur-2xl" />

          <div className="rounded-3xl border border-border bg-surface/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Radio className="h-4 w-4 text-accent" />
                Match centre
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated-surface px-2.5 py-1 text-[11px] font-medium text-muted-text">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {isDemo ? 'Demo preview' : 'Model preview'}
              </span>
            </div>

            {featured ? (
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
                  <span>{featured.competition}</span>
                  <span className="inline-flex items-center gap-1.5 text-accent">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    {featured.effectiveStatus === 'LIVE'
                      ? 'Live'
                      : featured.effectiveStatus === 'FINISHED'
                        ? 'Finished'
                        : 'Upcoming'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  {[featured.home, featured.away].map((team, index) => (
                    <div
                      key={team.id}
                      className={`flex min-w-0 flex-1 flex-col items-center gap-2 ${
                        index === 0 ? 'items-start text-left' : 'items-end text-right'
                      }`}
                    >
                      <TeamBadge team={team} size="lg" />
                      <span className="max-w-full break-words text-sm font-semibold leading-tight">
                        {team.name}
                      </span>
                    </div>
                  ))}

                  <div className="flex flex-col items-center">
                    {featured.score ? (
                      <span className="font-display text-2xl font-bold tabular-nums">
                        {featured.score.home}
                        <span className="mx-1 text-muted-text">:</span>
                        {featured.score.away}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-text">
                        vs
                      </span>
                    )}
                    <span className="mt-1 text-[10px] text-muted-text">{featured.kickoffLabel}</span>
                  </div>
                </div>

                {featured.probability ? (
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
                      <span>Win probability</span>
                      <span>{isDemo ? 'Illustrative' : 'Model estimate'}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-elevated-surface">
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: percent(featured.probability.home) }}
                        transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
                        className="h-full bg-accent"
                      />
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: percent(featured.probability.draw) }}
                        transition={{ duration: 0.9, delay: 0.7, ease: 'easeOut' }}
                        className="h-full bg-white/30"
                      />
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: percent(featured.probability.away) }}
                        transition={{ duration: 0.9, delay: 0.8, ease: 'easeOut' }}
                        className="h-full bg-[#5B8CFF]"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { label: 'Home', value: featured.probability.home, color: 'bg-accent' },
                        { label: 'Draw', value: featured.probability.draw, color: 'bg-white/30' },
                        { label: 'Away', value: featured.probability.away, color: 'bg-[#5B8CFF]' },
                      ].map(outcome => (
                        <div key={outcome.label} className="rounded-xl bg-elevated-surface/70 p-2.5">
                          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-text">
                            <span className={`h-1.5 w-1.5 rounded-full ${outcome.color}`} />
                            {outcome.label}
                          </span>
                          <span className="mt-1 block font-display text-lg font-semibold tabular-nums">
                            {percent(outcome.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-dashed border-border bg-background/40 px-4 py-5 text-center text-xs leading-relaxed text-muted-text">
                    Insufficient data for a reliable estimate on this fixture.
                  </div>
                )}

                <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-[11px] leading-relaxed text-muted-text">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  {isDemo
                    ? 'Fictional demo fixture. Probabilities illustrate the interface, not a real forecast.'
                    : 'Model output from stored, timestamped data. Probabilities are estimates, not guarantees.'}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/40 p-8 text-center">
                <Activity className="mx-auto h-6 w-6 text-muted-text" />
                <p className="mt-3 text-sm font-semibold">No fixtures available yet</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-text">
                  The stored dataset has no matches in range right now. Connect a provider or wait
                  for the next sync — this page never invents fixtures or probabilities.
                </p>
                <Link
                  href="/matches"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  Browse matches
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75, ease: 'easeOut' }}
            className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl border border-border bg-elevated-surface/95 px-4 py-3 shadow-xl backdrop-blur sm:flex"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold">No fake certainty</p>
              <p className="text-[11px] text-muted-text">Thin data means no prediction.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
