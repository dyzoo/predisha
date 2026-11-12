import Link from 'next/link'
import { ArrowUpRight, Radio } from 'lucide-react'
import { statusLabel } from '@/lib/bet/format'
import type { BetEvent } from '@/lib/bet/types'
import { OddsButton } from './odds-button'

export function EventCard({ event }: { event: BetEvent }) {
  const primary = event.markets.find(market => market.id === '1x2') ?? event.markets[0]
  const selections = primary?.selections.slice(0, 3) ?? []
  const probability = event.probability

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface/80 p-4 transition-colors hover:border-accent/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-muted-text">{event.competition}</p>
          <p className="mt-0.5 text-[11px] text-muted-text/80">
            {event.live ? 'In play' : event.kickoffLabel}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
            event.live
              ? 'bg-red-400/15 text-red-300'
              : event.effectiveStatus === 'SCHEDULED'
                ? 'bg-accent/10 text-accent'
                : 'bg-elevated-surface text-muted-text'
          }`}
        >
          {event.live ? <Radio className="h-3 w-3 animate-pulse" /> : null}
          {statusLabel(event.effectiveStatus)}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.home.color }}
            />
            <span className="truncate text-sm font-semibold">{event.home.name}</span>
          </div>
          <span className="shrink-0 text-lg font-bold tabular-nums">
            {event.score ? event.score.home : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.away.color }}
            />
            <span className="truncate text-sm font-semibold">{event.away.name}</span>
          </div>
          <span className="shrink-0 text-lg font-bold tabular-nums">
            {event.score ? event.score.away : '—'}
          </span>
        </div>
      </div>

      {probability ? (
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-background/60">
          <span className="bg-accent" style={{ width: `${Math.round(probability.home * 100)}%` }} />
          <span
            className="bg-muted-text/40"
            style={{ width: `${Math.round(probability.draw * 100)}%` }}
          />
          <span
            className="bg-sky-400"
            style={{ width: `${Math.round(probability.away * 100)}%` }}
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-stretch gap-2">
        {selections.map(selection => (
          <OddsButton key={selection.id} event={event} selection={selection} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-text">Simulated odds</span>
        <Link
          href={`/bet/match/${event.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
        >
          All markets
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  )
}
