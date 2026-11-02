import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  History,
  Lock,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { SettingsLocked } from '@/components/settings/settings-locked'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { marketLabelFor, type BuilderRisk } from '@/lib/predictions/builder-types'
import {
  HISTORY_LIMIT,
  listPredictionHistory,
  type PredictionHistoryItem,
  type SlipStatusValue,
} from '@/lib/predictions/history'
import { outcomeLabel } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Prediction history',
}

function statusStyles(status: SlipStatusValue): string {
  if (status === 'WON') return 'border-accent/30 bg-accent/10 text-accent'
  if (status === 'LOST') return 'border-red-400/25 bg-red-400/10 text-red-200'
  if (status === 'VOID') return 'border-amber-400/25 bg-amber-400/10 text-amber-200'
  return 'border-border bg-background/40 text-muted-text'
}

function statusIcon(status: SlipStatusValue) {
  if (status === 'WON') return CheckCircle2
  if (status === 'LOST') return XCircle
  if (status === 'VOID') return CircleAlert
  return Clock3
}

function selectionStatus(selection: PredictionHistoryItem['selections'][number]) {
  if (selection.correct === true) return { label: 'Hit', className: 'text-accent', icon: CheckCircle2 }
  if (selection.correct === false) return { label: 'Miss', className: 'text-red-300', icon: XCircle }
  return { label: 'Pending', className: 'text-muted-text', icon: CircleDashed }
}

function riskLabel(risk: string): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1) as BuilderRisk | string
}

export default async function HistoryPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Account" title="Prediction history">
        <SettingsLocked />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/history')

  let history: Awaited<ReturnType<typeof listPredictionHistory>> | null = null
  try {
    history = await listPredictionHistory(viewer.userId, HISTORY_LIMIT)
  } catch {
    history = null
  }

  return (
    <PageShell
      eyebrow="Account"
      title="Prediction history"
      intro="Every slip you build is stored with the probabilities that produced it. Finished fixtures are scored honestly, including misses."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-text transition-colors hover:text-accent"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          Back to dashboard
        </Link>
        <Link
          href="/builder"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
        >
          <Sparkles className="h-4 w-4" />
          Build a prediction
        </Link>
      </div>

      {!history ? (
        <div className="rounded-2xl border border-border bg-surface/50 p-6">
          <p className="flex items-start gap-2 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Prediction history is unavailable right now. This is usually a temporary database issue.
          </p>
        </div>
      ) : history.slips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <History className="mx-auto h-7 w-7 text-muted-text" />
          <p className="mt-3 text-base font-semibold">No saved predictions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
            Build a prediction slip and it will appear here with its stored probabilities and
            eventual result. Nothing is fabricated to fill this page.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Saved slips', value: history.summary.total },
              { label: 'Won', value: history.summary.won },
              { label: 'Lost', value: history.summary.lost },
              { label: 'Pending', value: history.summary.pending },
              { label: 'Void', value: history.summary.void },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                  {item.label}
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-text">
            Average Brier score:{' '}
            <span className="font-semibold text-main-text">
              {history.summary.averageBrier === null
                ? 'not enough settled selections'
                : history.summary.averageBrier.toFixed(4)}
            </span>
            . Lower is better. A single slip is not evidence of model performance.
          </p>

          <div className="space-y-4">
            {history.slips.map(slip => {
              const Icon = statusIcon(slip.status)
              return (
                <article
                  key={slip.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface/60"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <History className="h-4 w-4 text-accent" />
                        {slip.selections.length} selection{slip.selections.length === 1 ? '' : 's'} ·{' '}
                        {riskLabel(slip.risk)}
                        {slip.demo ? (
                          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            Demo
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-text">
                        {slip.generatedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC ·{' '}
                        {slip.modelVersion ?? 'model version unavailable'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles(slip.status)}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {slip.status}
                    </span>
                  </header>

                  <div className="grid gap-3 border-b border-border px-5 py-4 text-xs sm:grid-cols-2">
                    <div>
                      <p className="text-muted-text">Model confidence</p>
                      <p className="mt-1 font-semibold tabular-nums text-accent">
                        {Math.round(slip.combinedProbability * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-text">Risk profile</p>
                      <p className="mt-1 font-semibold">{riskLabel(slip.risk)}</p>
                    </div>
                  </div>

                  <ul className="divide-y divide-border">
                    {slip.selections.map(selection => {
                      const status = selectionStatus(selection)
                      const SelectionIcon = status.icon
                      return (
                        <li
                          key={selection.id}
                          className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/matches/${selection.fixtureId}`}
                              className="truncate font-semibold hover:text-accent"
                            >
                              {selection.homeName} <span className="text-muted-text">vs</span>{' '}
                              {selection.awayName}
                            </Link>
                            <p className="truncate text-[11px] text-muted-text">
                              {selection.competition} · {selection.kickoffUtc.toISOString().slice(0, 10)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-accent">
                              {marketLabelFor(selection.outcomeKey)}
                            </p>
                            <p className="text-[11px] tabular-nums text-muted-text">
                              {Math.round(selection.probability * 100)}%
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 font-semibold ${status.className}`}>
                            <SelectionIcon className="h-3.5 w-3.5" />
                            {status.label}
                            {selection.actualOutcome
                              ? ` (${outcomeLabel(selection.actualOutcome as 'HOME' | 'DRAW' | 'AWAY')})`
                              : ''}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  <footer className="px-5 py-3 text-[11px] text-muted-text">
                    Model output stored at build time. Later data changes do not rewrite this slip.
                  </footer>
                </article>
              )
            })}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-text">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Selections are estimates, not guarantees. Predisha does not place bets or hold funds, and
            a lost slip is shown without being hidden.
          </p>
        </>
      )}
    </PageShell>
  )
}

export const instant = false
