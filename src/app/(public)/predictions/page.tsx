import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, Lock, Radio, ShieldCheck, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { TeamBadge } from '@/components/teams/team-badge'
import { previewLimit } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { rankPredictions } from '@/lib/predictions/engine'
import { getMatchAnalyses } from '@/lib/sports/service'
import { outcomeLabel, toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Predictions',
  description: 'Ranked football predictions with transparent probabilities.',
}

export default async function PredictionsPage() {
  const { analyses, dataset } = await getMatchAnalyses()
  const upcoming = analyses
    .map(analysis => toMatchView(analysis))
    .filter(match => match.status === 'SCHEDULED' && match.probability && match.topOutcome)

  const ranked = rankPredictions(
    upcoming.map(match => ({
      match,
      probability: match.topOutcome!.probability,
      modelVersion: match.modelVersion ?? 'unknown',
      qualityFlags: match.qualityFlags,
    })),
  )

  const insufficient = upcoming.length - ranked.length
  const viewer = await getViewer()
  const limit = previewLimit(viewer, dataset.isDemo)
  const visible = limit === null ? ranked : ranked.slice(0, limit)
  const gated = ranked.length - visible.length
  const topMarkets = new Map(
    visible.map(({ match }) => [
      match.id,
      [...match.marketOptions]
        .filter(option => option.market !== '1X2')
        .sort((a, b) => b.probability - a.probability)[0] ?? null,
    ]),
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <Radio className="h-3.5 w-3.5" />
            Prediction board
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ranked by model probability
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-text sm:text-base">
            Ranked by the model&apos;s highest outcome probability, with the strongest secondary
            market and data-quality flags shown alongside. Only fixtures that clear the documented
            threshold and pass data gates are listed. A high probability is not a guaranteed result.
          </p>

          {dataset.isDemo ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Demo data: fictional fixtures and illustrative probabilities for local development
                only. Not real forecasts.
              </p>
            </div>
          ) : null}

          {!dataset.health.ok ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs leading-relaxed text-red-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{dataset.health.message}</p>
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface/60">
              <div className="hidden grid-cols-[40px_minmax(0,1fr)_100px_170px_120px] gap-3 border-b border-border px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text md:grid">
                <span>#</span>
                <span>Match</span>
                <span>Kickoff</span>
                <span>Home / Draw / Away</span>
                <span className="text-right">Top</span>
              </div>
              <ul className="divide-y divide-border">
                {visible.map(({ match }, index) => (
                  <li
                    key={match.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[40px_minmax(0,1fr)_100px_170px_120px] md:items-center md:gap-3"
                  >
                    <span className="hidden font-display text-sm font-bold text-muted-text md:block">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 -space-x-1.5">
                        <TeamBadge team={match.home} size="sm" />
                        <TeamBadge team={match.away} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/matches/${match.id}`}
                          className="truncate text-sm font-semibold hover:text-accent"
                        >
                          {match.home.name} <span className="text-muted-text">vs</span>{' '}
                          {match.away.name}
                        </Link>
                        <p className="truncate text-xs text-muted-text">
                          {match.competition}
                          {match.modelVersion ? ` · ${match.modelVersion}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-text">{match.kickoffLabel}</span>
                    <div>
                      <div
                        className="flex h-1.5 overflow-hidden rounded-full bg-elevated-surface"
                        role="img"
                        aria-label={`Home ${Math.round((match.probability?.home ?? 0) * 100)} percent, draw ${Math.round((match.probability?.draw ?? 0) * 100)} percent, away ${Math.round((match.probability?.away ?? 0) * 100)} percent`}
                      >
                        <span
                          className="h-full bg-accent"
                          style={{ width: `${(match.probability?.home ?? 0) * 100}%` }}
                        />
                        <span
                          className="h-full bg-white/25"
                          style={{ width: `${(match.probability?.draw ?? 0) * 100}%` }}
                        />
                        <span
                          className="h-full bg-[#5B8CFF]"
                          style={{ width: `${(match.probability?.away ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-text">
                        <span className="text-accent">
                          {Math.round((match.probability?.home ?? 0) * 100)}%
                        </span>
                        <span>{Math.round((match.probability?.draw ?? 0) * 100)}%</span>
                        <span className="text-[#5B8CFF]">
                          {Math.round((match.probability?.away ?? 0) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
                      <span className="font-display text-lg font-bold tabular-nums text-accent">
                        {Math.round((match.topOutcome?.probability ?? 0) * 100)}%
                      </span>
                      <span className="text-[10px] text-muted-text">
                        {match.topOutcome ? outcomeLabel(match.topOutcome.key) : ''}
                      </span>
                      {topMarkets.get(match.id) ? (
                        <span
                          className="max-w-[120px] truncate text-[10px] text-accent/80"
                          title={topMarkets.get(match.id)!.label}
                        >
                          Best: {topMarkets.get(match.id)!.label}{' '}
                          {Math.round(topMarkets.get(match.id)!.probability * 100)}%
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
              <BarChart3 className="mx-auto h-7 w-7 text-muted-text" />
              <p className="mt-3 text-base font-semibold">No predictions available</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
                Predictions appear only when valid, timestamped data is available. Nothing is
                fabricated to fill this page.
              </p>
            </div>
          )}

          {gated > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 px-4 py-3 text-xs">
              <span className="flex items-center gap-2 text-muted-text">
                <Lock className="h-4 w-4 text-accent" />
                {gated} more {gated === 1 ? 'prediction is' : 'predictions are'} available with a
                premium account.
              </span>
              <Link
                href={viewer.userId ? '/dashboard' : '/sign-up'}
                className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
              >
                {viewer.userId ? 'View account' : 'Create a free account'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}

          {insufficient > 0 ? (
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-text">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {insufficient} upcoming {insufficient === 1 ? 'fixture was' : 'fixtures were'} withheld
              because the data did not pass the quality gates.
            </p>
          ) : null}

          <div className="mt-8">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              Read the methodology
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
