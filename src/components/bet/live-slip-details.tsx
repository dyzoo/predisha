'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Radio } from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'
import { matchClock, type MatchClockState } from '@/lib/bet/match-clock'
import { simulatedScore } from '@/lib/bet/simulation'
import type { AdminBetSlipView } from '@/lib/bet/slips'
import { formatLiveMinute } from '@/lib/bet/types'

function teamsFromFixtureLabel(label: string) {
  const [home = 'Home', away = 'Away'] = label.split(/\s+vs\.?\s+/i)
  return {
    home: { name: home, short: home.slice(0, 3).toUpperCase() },
    away: { name: away, short: away.slice(0, 3).toUpperCase() },
  }
}

function phaseLabel(
  match: { phase: MatchClockState['phase']; finished?: boolean } | null,
): string {
  if (!match) return 'Pre-match'
  if (match.finished) return 'Full time'
  if (match.phase === 'HALF_TIME') return 'Half time'
  if (match.phase === 'FIRST_HALF') return 'First half'
  if (match.phase === 'FIRST_HALF_STOPPAGE') return 'First-half stoppage'
  if (match.phase === 'SECOND_HALF') return 'Second half'
  if (match.phase === 'SECOND_HALF_STOPPAGE') return 'Second-half stoppage'
  return 'In play'
}

export function LiveSlipDetails({ slip: view }: { slip: AdminBetSlipView }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!view.clock) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [view.clock])

  const match = view.clock ? matchClock(view.clock, now) : (view.matchClock ?? null)
  const live = Boolean(match?.live)
  const quote = view.quote

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-50/70">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-500/20 bg-emerald-100/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
            ) : null}
            <h2 className="font-display text-lg font-bold text-emerald-950">
              {view.title ?? `Slip ${view.code}`}
            </h2>
          </div>
          <p className="mt-0.5 font-mono text-xs font-bold tracking-[0.16em] text-emerald-700">
            {view.code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-600/25 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {phaseLabel(match)}
            {match && !match.finished ? ` · ${match.label}` : ''}
          </span>
          <Link
            href={`/bet/share/${encodeURIComponent(view.code)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to slip
          </Link>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-emerald-800">
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            {live ? 'Live match clock' : 'Match clock'}: {match?.label ?? 'Not started'}
          </span>
          {match ? (
            <span className="font-semibold">{Math.round(match.progress * 100)}% complete</span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-600/20 bg-white/70 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Stake</p>
            <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-950">
              {formatTzs(view.stakeMinor)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-600/20 bg-white/70 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Live odds</p>
            <p className="mt-0.5 font-mono text-sm font-black tabular-nums text-emerald-700">
              {formatOdds(quote.totalOdds)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-600/20 bg-white/70 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Possible return</p>
            <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-950">
              {formatTzs(quote.potentialReturnMinor)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-600/20 bg-white/70 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Net payout</p>
            <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-950">
              {formatTzs(quote.netPayoutMinor)}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {view.selections.map((selection, index) => {
            const teams = teamsFromFixtureLabel(selection.fixtureLabel)
            const selectionClock = selection.simulation ?? view.clock
            const selectionMatch = selectionClock ? matchClock(selectionClock, now) : null
            const score =
              selection.liveScore ??
              (view.timeMode === 'SIMULATED' && selectionClock && selectionMatch
                ? simulatedScore(selection, selectionClock, selectionMatch.minute)
                : null)
            return (
              <li
                key={`${selection.fixtureId}:${selection.marketId}:${selection.selectionId}:${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-600/20 bg-white/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-emerald-950">
                    {teams.home.name} vs {teams.away.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-emerald-700">
                    {selection.marketName} · {selection.selectionLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-emerald-700/80">
                    {selection.kickoffLabel ?? selection.kickoffIso ?? 'Kickoff time unavailable'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {score ? (
                    <span className="rounded-md bg-emerald-100 px-2 py-1 font-mono text-xs font-bold tabular-nums text-emerald-900">
                      {score.home} - {score.away}
                    </span>
                  ) : null}
                  <span className="text-[10px] font-bold text-red-700">
                    {formatLiveMinute(selection.liveMinute) ??
                      selectionMatch?.label ??
                      (selectionClock ? 'Not started' : '')}
                  </span>
                  <span className="rounded-md border border-emerald-600/30 bg-emerald-100 px-2 py-1 font-mono text-xs font-black tabular-nums text-emerald-700">
                    {formatOdds(selection.odds)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-3 text-[10px] leading-relaxed text-emerald-800">
          Live prices fall as the match progresses. A stake placed on the shared slip now settles
          at the live odds shown above. Cash-out offers recalculate with the match clock.
        </p>
      </div>
    </section>
  )
}
