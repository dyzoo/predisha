import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import { MarketPanel } from '@/components/bet/market-panel'
import { statusLabel } from '@/lib/bet/format'
import { getBetEvent } from '@/lib/bet/catalog'

type Params = Promise<{ fixtureId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection()
  const { fixtureId } = await params
  const { event } = await getBetEvent(fixtureId)
  if (!event) return { title: 'Fixture not found' }
  return {
    title: `${event.home.name} vs ${event.away.name}`,
    description: `Simulated odds for ${event.home.name} vs ${event.away.name} in ${event.competition}.`,
  }
}

export default async function BetMatchPage({ params }: { params: Params }) {
  await connection()
  const { fixtureId } = await params
  const { event } = await getBetEvent(fixtureId)
  if (!event) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/bet/sports"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-text hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to fixtures
      </Link>

      <section className="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-accent/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {event.competition}
            </p>
            <p className="mt-1 text-xs text-muted-text">{event.kickoffLabel}</p>
          </div>
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              event.live ? 'bg-red-400/15 text-red-300' : 'bg-elevated-surface text-muted-text'
            }`}
          >
            {event.live ? <Radio className="h-3 w-3 animate-pulse" /> : null}
            {statusLabel(event.effectiveStatus)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex min-w-0 flex-col items-center text-center">
            <span
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: event.home.color }}
            />
            <p className="mt-2 text-sm font-semibold sm:text-lg">{event.home.name}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl font-bold tabular-nums sm:text-5xl">
              {event.score ? `${event.score.home}–${event.score.away}` : 'vs'}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-text">Simulated odds</p>
          </div>
          <div className="flex min-w-0 flex-col items-center text-center">
            <span
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: event.away.color }}
            />
            <p className="mt-2 text-sm font-semibold sm:text-lg">{event.away.name}</p>
          </div>
        </div>

        {event.probability ? (
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Home', value: event.probability.home },
              { label: 'Draw', value: event.probability.draw },
              { label: 'Away', value: event.probability.away },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-background/40 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {(item.value * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-[11px] text-muted-text">
          {event.sourceLabel}
          {event.modelVersion ? ` · model ${event.modelVersion}` : ''}
        </p>
      </section>

      <MarketPanel event={event} />

      <p className="text-[11px] leading-relaxed text-muted-text">
        Prices are generated from model probabilities with a 6% book margin. A selection is frozen
        at the price shown when you place the bet; if the model price has moved by more than 0.02,
        the API asks you to review the slip instead of accepting a stale price.
      </p>
    </div>
  )
}

export const instant = false
