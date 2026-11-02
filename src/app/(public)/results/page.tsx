import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, CheckCircle2, CircleDashed, TriangleAlert, XCircle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { TeamBadge } from '@/components/teams/team-badge'
import { getMatchAnalyses, summarizeEvaluations } from '@/lib/sports/service'
import { formatDateTime, outcomeLabel, toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Results',
  description: 'Historical predictions compared with actual results, with honest metrics.',
}

export default async function ResultsPage() {
  const { analyses, dataset } = await getMatchAnalyses()
  const summary = summarizeEvaluations(analyses)
  const rows = analyses
    .filter(analysis => analysis.fixture.status === 'FINISHED' && analysis.evaluation)
    .map(analysis => toMatchView(analysis))
    .sort((a, b) => new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime())

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <BarChart3 className="h-3.5 w-3.5" />
            Transparency
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Results &amp; model record
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-text sm:text-base">
            Finished fixtures are scored against the model&apos;s pre-match probability estimate,
            recomputed from the stored dataset. This is the model record, not a log of saved user
            slips. Metrics are shown with sample size and date range. Accuracy is secondary to
            calibration and proper scoring rules.
          </p>

          {dataset.isDemo ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Demo data: fictional fixtures and illustrative probabilities. These metrics validate
                the pipeline, not real-world model performance.
              </p>
            </div>
          ) : null}

          {summary.sampleSize > 0 ? (
            <>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Sample size', value: String(summary.sampleSize) },
                  {
                    label: 'Brier score',
                    value: summary.brierScore?.toFixed(4) ?? '—',
                  },
                  { label: 'Log loss', value: summary.logLoss?.toFixed(4) ?? '—' },
                  {
                    label: 'Accuracy',
                    value: summary.accuracy !== null ? `${Math.round(summary.accuracy * 100)}%` : '—',
                  },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                      {item.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-muted-text">
                Date range:{' '}
                {summary.from && summary.to
                  ? `${formatDateTime(summary.from)} to ${formatDateTime(summary.to)}`
                  : '—'}
                . Lower Brier and log loss are better. These figures are not a profitability claim.
              </p>

              <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface/60">
                <div className="hidden grid-cols-[minmax(0,1fr)_90px_130px_80px_80px] gap-3 border-b border-border px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text md:grid">
                  <span>Match</span>
                  <span>Final</span>
                  <span>Prediction</span>
                  <span>Brier</span>
                  <span className="text-right">Outcome</span>
                </div>
                <ul className="divide-y divide-border">
                  {rows.slice(0, 40).map(row => (
                    <li
                      key={row.id}
                      className="grid grid-cols-1 gap-2 px-5 py-4 text-sm transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,1fr)_90px_130px_80px_80px] md:items-center md:gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex shrink-0 -space-x-1">
                          <TeamBadge team={row.home} size="xs" />
                          <TeamBadge team={row.away} size="xs" />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/matches/${row.id}`} className="truncate font-semibold hover:text-accent">
                            {row.home.name} <span className="text-muted-text">vs</span> {row.away.name}
                          </Link>
                          <p className="truncate text-xs text-muted-text">
                            {row.competition} · {row.kickoffLabel}
                          </p>
                        </div>
                      </div>
                      <span className="font-display text-base font-bold tabular-nums">
                        {row.score?.home}–{row.score?.away}
                      </span>
                      <span className="text-xs text-muted-text">
                        {row.topOutcome ? outcomeLabel(row.topOutcome.key) : '—'}{' '}
                        {row.topOutcome ? `(${Math.round(row.topOutcome.probability * 100)}%)` : ''}
                      </span>
                      <span className="text-xs tabular-nums text-muted-text">
                        {row.evaluation?.brierScore.toFixed(4)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs md:justify-end">
                        {row.evaluation?.correct ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-accent" />
                            <span className="text-accent">Hit</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-300" />
                            <span className="text-red-300">Miss</span>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs leading-relaxed text-muted-text">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  These metrics are recomputed from the stored dataset each time the page loads;
                  they are not a historical log. Saved prediction slips keep their own build-time
                  probabilities and are scored separately in your prediction history. Postponed,
                  cancelled and abandoned matches are excluded from evaluation.
                </p>
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
              <BarChart3 className="mx-auto h-7 w-7 text-muted-text" />
              <p className="mt-3 text-base font-semibold">No evaluated predictions yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
                Results appear once finished fixtures have a valid pre-match prediction. We do not
                invent a performance record.
              </p>
            </div>
          )}

          <div className="mt-8">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              How evaluation works
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
