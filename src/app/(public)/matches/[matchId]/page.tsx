import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CircleAlert,
  Clock3,
  Info,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { BetSlip } from '@/components/matches/bet-slip'
import { SaveMatchButton } from '@/components/matches/save-match-button'
import { TeamBadge } from '@/components/teams/team-badge'
import { canViewPremium } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getMatchAnalysis } from '@/lib/sports/service'
import { formatDateTime, formatMatchTime, outcomeLabel, toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Match analysis',
  description: 'Transparent probabilities, input timestamps and the data behind a football prediction.',
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formStyles(result: string): string {
  if (result === 'W') return 'bg-accent/20 text-accent'
  if (result === 'L') return 'bg-red-500/15 text-red-300'
  return 'bg-white/10 text-muted-text'
}

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const { analysis, dataset } = await getMatchAnalysis(matchId)

  if (!analysis) notFound()

  const view = toMatchView(analysis)
  const { fixture, prediction, features, home, away, competition, sport } = analysis
  const isFinished = view.effectiveStatus === 'FINISHED'

  const viewer = await getViewer()
  const premiumView = canViewPremium(viewer) || dataset.isDemo
  const initialSaved = viewer.userId
    ? await prisma.savedFixture
        .findUnique({
          where: { userId_fixtureId: { userId: viewer.userId, fixtureId: fixture.id } },
          select: { id: true },
        })
        .then(item => Boolean(item))
        .catch(() => false)
    : false

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-text transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to matches
          </Link>

          <header className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface/70 p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
              <span>
                {sport.name} · {competition.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated-surface px-2.5 py-1">
                {view.effectiveStatus === 'LIVE' ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                ) : (
                  <CalendarClock className="h-3 w-3" />
                )}
                {view.effectiveStatus}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
              <div className="flex min-w-0 flex-col items-start gap-3">
                <TeamBadge team={view.home} size="xl" />
                <div className="min-w-0">
                  <h1 className="break-words font-display text-lg font-bold leading-tight sm:text-2xl">
                    {home.name}
                  </h1>
                  <p className="mt-1 text-xs text-muted-text">Home</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-center text-center">
                {typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number' ? (
                  <span className="whitespace-nowrap font-display text-2xl font-bold tabular-nums sm:text-4xl">
                    {fixture.homeScore}
                    <span className="mx-2 text-muted-text">:</span>
                    {fixture.awayScore}
                  </span>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-text">
                    vs
                  </span>
                )}
                <span className="mt-2 max-w-[110px] text-[10px] leading-relaxed text-muted-text sm:max-w-[150px] sm:text-[11px]">
                  {formatMatchTime(fixture.kickoffUtc)}
                </span>
              </div>

              <div className="flex min-w-0 flex-col items-end gap-3 text-right">
                <TeamBadge team={view.away} size="xl" />
                <div className="min-w-0">
                  <h2 className="break-words font-display text-lg font-bold leading-tight sm:text-2xl">
                    {away.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-text">Away</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5 text-xs text-muted-text">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                Kickoff UTC: {formatDateTime(fixture.kickoffUtc)}
              </span>
              {prediction ? (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  Input as of {formatDateTime(prediction.inputDataAsOf)}
                </span>
              ) : null}
              <div className="ml-auto">
                <SaveMatchButton
                  fixtureId={fixture.id}
                  initialSaved={initialSaved}
                  signedIn={Boolean(viewer.userId)}
                  authConfigured={isAuthConfigured()}
                />
              </div>
            </div>
          </header>

          {dataset.isDemo ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Demo fixture and fictional teams. Probabilities illustrate the interface and model
                contract only; they are not real forecasts.
              </p>
            </div>
          ) : null}

          {view.evaluation ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface/50 px-4 py-3 text-xs text-muted-text">
              <span className="font-semibold text-main-text">Post-match evaluation</span>
              <span>Actual: {outcomeLabel(view.evaluation.actualOutcome)}</span>
              <span>Brier: {view.evaluation.brierScore.toFixed(4)}</span>
              <span>Log loss: {view.evaluation.logLoss.toFixed(4)}</span>
              <span className={view.evaluation.correct ? 'text-accent' : 'text-red-300'}>
                {view.evaluation.correct ? 'Top outcome correct' : 'Top outcome missed'}
              </span>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">1X2 probabilities</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                  {prediction?.modelVersion ?? 'No model output'}
                </span>
              </div>

              {prediction && view.probability ? (
                <>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      { key: 'HOME' as const, label: 'Home', value: view.probability.home, className: 'bg-accent', text: 'text-accent' },
                      { key: 'DRAW' as const, label: 'Draw', value: view.probability.draw, className: 'bg-white/30', text: 'text-main-text' },
                      { key: 'AWAY' as const, label: 'Away', value: view.probability.away, className: 'bg-[#5B8CFF]', text: 'text-[#8FB4FF]' },
                    ].map(outcome => (
                      <div key={outcome.key} className="rounded-xl border border-border bg-background/40 p-3">
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${outcome.className}`} />
                          {outcome.label}
                        </span>
                        <span className={`mt-1 block font-display text-xl font-bold tabular-nums ${outcome.text}`}>
                          {percent(outcome.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-elevated-surface" role="img" aria-label={`Home ${percent(view.probability.home)}, draw ${percent(view.probability.draw)}, away ${percent(view.probability.away)}`}>
                    <span className="h-full bg-accent" style={{ width: percent(view.probability.home) }} />
                    <span className="h-full bg-white/30" style={{ width: percent(view.probability.draw) }} />
                    <span className="h-full bg-[#5B8CFF]" style={{ width: percent(view.probability.away) }} />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
                        Other model markets
                      </h3>
                      <span className="text-[10px] uppercase tracking-wide text-muted-text">
                        Ranked by probability
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {view.marketOptions
                        .filter(option => option.market !== '1X2')
                        .sort((a, b) => b.probability - a.probability)
                        .slice(0, 6)
                        .map(option => (
                          <div
                            key={option.key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{option.label}</p>
                              <p className="text-[10px] uppercase tracking-wide text-muted-text">
                                {option.market} · {option.risk} risk
                              </p>
                            </div>
                            <span className="font-display text-sm font-bold tabular-nums text-accent">
                              {percent(option.probability)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-text">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    Expected goals: {prediction.homeExpectedGoals.toFixed(2)} home,{' '}
                    {prediction.awayExpectedGoals.toFixed(2)} away. Probabilities are estimates, not
                    certainties or betting advice.
                  </p>
                </>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center">
                  <CircleAlert className="mx-auto h-6 w-6 text-muted-text" />
                  <p className="mt-3 text-sm font-semibold">
                    Insufficient data for a reliable estimate
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-text">
                    The model withholds a prediction when either team has too few eligible matches or
                    the input snapshot is stale. It does not guess to fill the gap.
                  </p>
                </div>
              )}

              {prediction && premiumView ? (
                <div className="mt-6 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
                    Explanation
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-text">{analysis.explanation}</p>
                  <div className="flex flex-wrap gap-2">
                    {prediction.qualityFlags.map(flag => (
                      <span
                        key={flag}
                        className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                      >
                        {flag.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : prediction ? (
                <div className="mt-6 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
                    Why this prediction
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-text">{analysis.explanation}</p>
                  <div className="flex flex-wrap gap-2">
                    {prediction.qualityFlags.map(flag => (
                      <span
                        key={flag}
                        className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                      >
                        {flag.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="space-y-4">
              {!isFinished ? <BetSlip match={view} premium={premiumView} /> : (
                <section className="rounded-2xl border border-border bg-surface/60 p-5">
                  <h2 className="font-display text-base font-bold">Pre-match prediction snapshot</h2>
                  <p className="mt-2 text-xs text-muted-text">This is what the model estimated before kickoff, preserved unchanged.</p>
                  {prediction ? (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between"><span>Model</span> <span className="font-semibold">{prediction.modelVersion}</span></div>
                      <div className="flex justify-between"><span>1X2 probability (home/draw/away)</span> <span className="font-semibold">{percent(view.probability?.home ?? 0)} / {percent(view.probability?.draw ?? 0)} / {percent(view.probability?.away ?? 0)}</span></div>
                      <div className="flex justify-between"><span>Expected goals</span> <span className="font-semibold">{prediction.homeExpectedGoals.toFixed(2)} / {prediction.awayExpectedGoals.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Data as of</span> <span className="font-semibold">{formatDateTime(prediction.inputDataAsOf)}</span></div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-muted-text">No pre-match prediction was generated.</p>
                  )}
                </section>
              )}
              <section className="rounded-2xl border border-border bg-surface/60 p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  Input snapshot
                </h2>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Model</dt>
                    <dd className="font-semibold">{prediction?.modelVersion ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Home sample</dt>
                    <dd className="font-semibold tabular-nums">{features.home.matches} matches</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Away sample</dt>
                    <dd className="font-semibold tabular-nums">{features.away.matches} matches</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Home Elo</dt>
                    <dd className="font-semibold tabular-nums">{Math.round(features.home.elo)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Away Elo</dt>
                    <dd className="font-semibold tabular-nums">{Math.round(features.away.elo)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-text">Data as of</dt>
                    <dd className="font-semibold">
                      {prediction ? formatDateTime(prediction.inputDataAsOf) : '—'}
                    </dd>
                  </div>
                </dl>
              </section>

              {premiumView ? (
                <section className="rounded-2xl border border-border bg-surface/60 p-5">
                  <h2 className="font-display text-base font-bold">Recent form</h2>
                  <div className="mt-4 space-y-4">
                    {[analysis.home, analysis.away].map((team, index) => {
                      const form = index === 0 ? features.home.form : features.away.form
                      return (
                        <div key={team.id}>
                          <p className="text-xs font-semibold">{team.name}</p>
                          <div className="mt-2 flex gap-1.5">
                            {form.length > 0 ? (
                              form.map((result, resultIndex) => (
                                <span
                                  key={`${team.id}-${result}-${resultIndex}`}
                                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${formStyles(result)}`}
                                >
                                  {result}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-text">No recent form available</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-muted-text">
                    Form is computed only from finished matches before the prediction cutoff.
                  </p>
                </section>
              ) : null}

              <section className="rounded-2xl border border-border bg-surface/60 p-5">
                <h2 className="font-display text-base font-bold">How this analysis was generated</h2>
                <div className="mt-3 grid gap-2 text-xs text-muted-text">
                  <div className="flex justify-between"><span>Source providers</span> <span className="font-semibold text-main-text">{dataset.isDemo ? 'demo' : 'stored dataset'}</span></div>
                  <div className="flex justify-between"><span>Data freshness</span> <span className="font-semibold text-main-text">{dataset.health?.message ?? 'Unknown'}</span></div>
                  <div className="flex justify-between"><span>Model version</span> <span className="font-semibold text-main-text">{prediction?.modelVersion ?? '—'}</span></div>
                  <div className="flex justify-between"><span>Historical matches used</span> <span className="font-semibold text-main-text">{features.home.matches + features.away.matches}</span></div>
                  <div className="flex justify-between"><span>Prediction timestamp</span> <span className="font-semibold text-main-text">{prediction?.generatedAt ? new Date(prediction.generatedAt).toLocaleString() : '—'}</span></div>
                  <div className="flex justify-between"><span>Missing features</span> <span className="font-semibold text-main-text">{prediction?.qualityFlags?.join(', ') || 'None'}</span></div>
                  <div className="flex justify-between"><span>Odds source</span> <span className="font-semibold text-main-text">{analysis.prediction ? 'model-implied' : 'unavailable'}</span></div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-text">
                  Data providers: {dataset.isDemo ? 'demo dataset' : 'football-data.org'}.
                  Last refresh time: {dataset.health ? new Date().toISOString().slice(0,10) : '—'}.
                  Historical matches used for ratings and form only.
                  Missing features are excluded rather than inferred.
                </p>
              </section>

              <section className="rounded-2xl border border-border bg-surface/60 p-5">
                <h2 className="font-display text-base font-bold">Transparency</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-text">
                  Every prediction stores the model version, input timestamp and data-quality flags.
                  Pre-match predictions are not silently rewritten after kickoff.
                </p>
                <Link
                  href="/methodology"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  Read the methodology
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            </aside>
          </div>

          {isFinished ? (
            <section className="mt-6 rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="font-display text-lg font-bold">Match statistics</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Home team</p>
                  <p className="mt-1 font-semibold">{home.name}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Away team</p>
                  <p className="mt-1 font-semibold">{away.name}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Competition</p>
                  <p className="mt-1 font-semibold">{competition.name}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Status</p>
                  <p className="mt-1 font-semibold">{fixture.status}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Kickoff</p>
                  <p className="mt-1 font-semibold">{formatDateTime(fixture.kickoffUtc)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Score</p>
                  <p className="mt-1 font-semibold">{fixture.homeScore ?? '-'} - {fixture.awayScore ?? '-'}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Form (home)</p>
                  <p className="mt-1 font-semibold">{features.home.form.map(r => r === 'W' ? 'W' : r === 'D' ? 'D' : 'L').join(' · ') || '—'}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-muted-text">Form (away)</p>
                  <p className="mt-1 font-semibold">{features.away.form.map(r => r === 'W' ? 'W' : r === 'D' ? 'D' : 'L').join(' · ') || '—'}</p>
                </div>
              </div>
            </section>
          ) : null}

          {isFinished && !view.evaluation ? (
            <p className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs leading-relaxed text-muted-text">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              This match finished before a valid pre-match prediction could be generated, so no
              evaluation is shown.
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
