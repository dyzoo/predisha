'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, BarChart3, Brain, Check, ChevronDown, ChevronUp, CircleAlert, Database, Download, Layers, ListChecks, Loader2, LogIn, Lock, Share2, ShieldCheck, Sparkles, Target, TrendingUp, UserPlus } from 'lucide-react'
import { useViewer } from '@/components/ui/viewer-provider'
import { TeamBadge } from '@/components/teams/team-badge'
import {
  BUILDER_RISKS,
  BUILDER_RISK_CONFIG,
  percent,
  type BuilderResult,
  type BuilderRisk,
} from '@/lib/predictions/builder-types'
import { renderSlipImage } from './slip-image'

interface BetBuilderProps {
  premium: boolean
  currency: string
  demo: boolean
  eligibleCount: number
  freePreviewUsed: boolean
}

const steps = [
  {
    icon: TrendingUp,
    title: 'Choose a risk profile',
    body: 'Conservative, balanced or aggressive changes how many selections and which markets the model favours.',
  },
  {
    icon: Target,
    title: 'The model ranks options',
    body: 'Stored, timestamped data is filtered by the quality gates, then the best market options are compared.',
  },
  {
    icon: ListChecks,
    title: 'Review the slip',
    body: 'See every selection together with its model probability.',
  },
  {
    icon: Share2,
    title: 'Download or share',
    body: 'Export the slip as an image and take it to any provider you trust.',
  },
]

const ANALYSIS_STAGES = [
  {
    icon: Database,
    title: 'Reading the fixture dataset',
    detail: 'Loading stored fixtures, scores and timestamps.',
  },
  {
    icon: ShieldCheck,
    title: 'Filtering weak data',
    detail: 'Applying sample-size, freshness and quality gates.',
  },
  {
    icon: BarChart3,
    title: 'Running the match model',
    detail: 'Building the Elo ratings and Poisson score distribution.',
  },
  {
    icon: Layers,
    title: 'Comparing markets',
    detail: 'Checking 1X2, double chance, totals and both-teams-to-score.',
  },
  {
    icon: Sparkles,
    title: 'Preparing your prediction',
    detail: 'Ranking the strongest options for your risk profile.',
  },
]

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function shareText(result: BuilderResult): string {
  const lines = [
    'Predisha AI prediction slip',
    `Selections: ${result.selections.length}`,
    `Model confidence: ${percent(result.combinedProbability)}`,
    '',
    ...result.selections.map(
      (selection, index) =>
        `${index + 1}. ${selection.homeName} vs ${selection.awayName} — ${selection.market}: ${selection.outcomeLabel} (${percent(selection.probability)})`,
    ),
    '',
    'Estimated analysis only. Not betting advice. The platform does not place bets.',
  ]
  return lines.join('\n')
}

export function BetBuilder({
  premium,
  currency,
  demo,
  eligibleCount,
  freePreviewUsed,
}: BetBuilderProps) {
  const { viewer, loading } = useViewer()
  const signedIn = Boolean(viewer?.userId)

  const [risk, setRisk] = useState<BuilderRisk>('balanced')
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [stage, setStage] = useState(0)
  const [result, setResult] = useState<BuilderResult | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedSelectionId, setExpandedSelectionId] = useState<string | null>(null)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/50 p-8 text-center sm:p-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent/15 text-accent mb-4">
          <UserPlus className="h-8 w-8" />
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          Sign in to build predictions
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-text sm:text-center sm:text-base">
          You need an account to create AI prediction slips. Sign in or create a free account to
          start building.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in?next=/builder"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
          <Link
            href="/sign-up?next=/builder"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </Link>
        </div>
      </div>
    )
  }

  function stopStageTimer() {
    if (stageTimer.current) {
      clearInterval(stageTimer.current)
      stageTimer.current = null
    }
  }

  const freePreviewLocked = !premium && !demo && (freePreviewUsed || Boolean(result))

  async function handleBuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setStatus('loading')
    setStage(0)
    setError(null)
    setResult(null)
    setReceipt(null)
    setCopied(false)
    stopStageTimer()
    const startedAt = Date.now()
    stageTimer.current = setInterval(() => {
      setStage(current => (current < ANALYSIS_STAGES.length - 2 ? current + 1 : current))
    }, 650)

    try {
      const response = await fetch('/api/predictions/build', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stake: 1,
          risk,
          timeRange,
          currency,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { data?: BuilderResult; error?: string }
        | null

      if (!response.ok || !payload?.data) {
        stopStageTimer()
        setError(payload?.error ?? 'Could not build a prediction right now.')
        setStatus('error')
        return
      }

      const elapsed = Date.now() - startedAt
      if (elapsed < 2600) await wait(2600 - elapsed)

      stopStageTimer()
      setStage(ANALYSIS_STAGES.length - 1)
      setResult(payload.data)
      setReceipt(renderSlipImage(payload.data))
      setStatus('done')
    } catch {
      stopStageTimer()
      setError('Network error. Check your connection and try again.')
      setStatus('error')
    }
  }

  function handleDownload() {
    if (!receipt || !result) return
    const link = document.createElement('a')
    link.href = receipt
    link.download = `predisha-bet-slip-${result.generatedAt.slice(0, 10)}.png`
    link.click()
  }

  async function handleShare() {
    if (!result) return
    const text = shareText(result)
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        if (receipt) {
          const blob = await (await fetch(receipt)).blob()
          const file = new File(
            [blob],
            `predisha-bet-slip-${result.generatedAt.slice(0, 10)}.png`,
            { type: 'image/png' },
          )
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: 'Predisha AI prediction slip',
              text,
              files: [file],
            })
            return
          }
        }
        await navigator.share({ title: 'Predisha AI prediction slip', text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The share sheet was dismissed or the clipboard was blocked.
      try {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } catch {
        // Fallback silent
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <form
          onSubmit={handleBuild}
          className="h-fit rounded-2xl border border-border bg-surface/60 p-5 sm:p-6"
        >
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Sparkles className="h-4 w-4 text-accent" />
            Prediction inputs
          </h2>

          <div className="mt-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-text">
              Risk preference
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {BUILDER_RISKS.map(option => {
                const active = risk === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRisk(option)}
                    aria-pressed={active}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-background/40 text-muted-text hover:text-main-text'
                    }`}
                  >
                    {BUILDER_RISK_CONFIG[option].label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-text">
              {BUILDER_RISK_CONFIG[risk].description}
            </p>
          </div>

          <div className="mt-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-text">
              Time range
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { key: 'day' as const, label: 'Today' },
                { key: 'week' as const, label: 'This week' },
                { key: 'month' as const, label: 'This month' },
              ].map(option => {
                const active = timeRange === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTimeRange(option.key)}
                    aria-pressed={active}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-background/40 text-muted-text hover:text-main-text'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-text">
              The system will only include fixtures within the selected time window.
            </p>
          </div>

          <button
            type="submit"
            disabled={status === 'loading' || freePreviewLocked}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {status === 'loading'
              ? 'Analyzing fixtures…'
              : freePreviewLocked
                ? 'Free preview used'
                : 'Analyze upcoming matches'}
          </button>

          {!premium && !demo ? (
            <div className="mt-4 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5 text-[11px] leading-relaxed text-accent">
              <p className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {freePreviewLocked
                  ? 'Your free preview has been used and saved to history. Premium unlocks new slips and full combinations.'
                  : 'One free preview per account, saved to your prediction history. It shows up to three combined selections; premium unlocks five.'}
              </p>
              {freePreviewLocked ? (
                <Link
                  href="/pricing"
                  className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  See premium
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </form>

        <div>
          {status === 'loading' ? (
            <div className="min-h-[420px] rounded-2xl border border-accent/20 bg-surface/60 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <Brain className="h-5 w-5" />
                    <span className="absolute inset-0 animate-ping rounded-xl border border-accent/30" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">AI analysis in progress</p>
                    <p className="text-[11px] text-muted-text">Pipeline stages update as the data is processed.</p>
                  </div>
                </div>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-elevated-surface">
                <span
                  className="block h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.min(100, ((stage + 1) / ANALYSIS_STAGES.length) * 100)}%` }}
                />
              </div>

              <ol className="mt-5 space-y-2.5">
                {ANALYSIS_STAGES.map((item, index) => {
                  const complete = index < stage
                  const active = index === stage
                  return (
                    <li
                      key={item.title}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                        active
                          ? 'border-accent/30 bg-accent/10'
                          : complete
                            ? 'border-border bg-background/30'
                            : 'border-transparent bg-background/20 opacity-55'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          complete
                            ? 'bg-accent text-background'
                            : active
                              ? 'bg-accent/15 text-accent'
                              : 'bg-white/5 text-muted-text'
                        }`}
                      >
                        {complete ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <item.icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-text">{item.detail}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-text">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                Every result comes from the stored dataset and the documented model gates. No
                fixture is invented and nothing is guaranteed.
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center">
              <CircleAlert className="h-7 w-7 text-red-300" />
              <p className="mt-4 text-sm font-semibold text-red-200">{error}</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-red-200/80">
                {eligibleCount > 0
                  ? `${eligibleCount} upcoming fixtures currently have a model estimate.`
                  : 'No fixtures currently pass the model quality gates.'}
              </p>
            </div>
          ) : result ? (
            <div className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                    Your AI prediction slip
                  </p>
                  <p className="mt-1 text-xs text-muted-text">
                    {result.selections.length} selection{result.selections.length === 1 ? '' : 's'} ·{' '}
                    {BUILDER_RISK_CONFIG[result.risk].label}
                  </p>
                </div>
                <span className="rounded-full border border-border bg-background/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                  Estimate only
                </span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-accent/25 bg-accent/[0.07] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                    Markets compared
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tabular-nums">
                    {result.selections.reduce(
                      (total, selection) => total + 1 + selection.alternatives.length,
                      0,
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                    Model confidence
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tabular-nums">
                    {percent(result.combinedProbability)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                    Data snapshot
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold">
                    {result.dataAsOf ?? 'Stored dataset'}
                  </p>
                </div>
              </div>

              <ul className="mt-5 divide-y divide-border rounded-xl border border-border bg-background/30">
                {result.selections.map((selection, index) => (
                  <li key={selection.fixtureId} className="p-3.5">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-background">
                        {index + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <div className="flex shrink-0 -space-x-1.5">
                          <TeamBadge
                            team={{
                              name: selection.homeName,
                              short: selection.homeShort,
                              color: selection.homeColor,
                              logoUrl: selection.homeLogoUrl,
                            }}
                            size="sm"
                          />
                          <TeamBadge
                            team={{
                              name: selection.awayName,
                              short: selection.awayShort,
                              color: selection.awayColor,
                              logoUrl: selection.awayLogoUrl,
                            }}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold">
                            {selection.homeName} <span className="text-muted-text">vs</span>{' '}
                            {selection.awayName}
                          </p>
                          <p className="truncate text-[11px] text-muted-text">
                            {selection.competition} · {selection.kickoffLabel}
                          </p>
                        </div>
                      </div>
                      <div className="ml-auto shrink-0 text-right">
                        <p className="text-xs font-semibold text-accent">{selection.outcomeLabel}</p>
                        <p className="text-[11px] tabular-nums text-muted-text">
                          {percent(selection.probability)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSelectionId(
                              expandedSelectionId === selection.fixtureId ? null : selection.fixtureId
                            )
                          }
                          className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-background/50"
                        >
                          {expandedSelectionId === selection.fixtureId ? (
                            <span className="flex items-center gap-1">
                              <ChevronUp className="h-3 w-3" />
                              Less detail
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" />
                              Why this pick
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-10 text-[10px]">
                      <span className="rounded-full border border-border bg-white/5 px-2 py-0.5 font-semibold text-muted-text">
                        {selection.market}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${
                          selection.riskLevel === 'low'
                            ? 'bg-accent/10 text-accent'
                            : selection.riskLevel === 'medium'
                              ? 'bg-amber-400/10 text-amber-200'
                              : 'bg-red-400/10 text-red-200'
                        }`}
                      >
                        {selection.riskLevel} risk
                      </span>
                    </div>
                    <p className="mt-2 pl-10 text-[11px] leading-relaxed text-muted-text">
                      {selection.reason}
                    </p>
                    {selection.alternatives.length > 0 ? (
                      <p className="mt-1.5 pl-10 text-[10px] leading-relaxed text-muted-text/80">
                        Also considered:{' '}
                        {selection.alternatives
                          .map(option => `${option.label} ${percent(option.probability)}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <div className="mt-2 ml-10 h-1 overflow-hidden rounded-full bg-elevated-surface">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: percent(selection.probability) }}
                      />
                    </div>
                    {expandedSelectionId === selection.fixtureId && (
                      <div className="mt-3 pl-10 rounded-xl border border-border bg-background/40 p-3">
                        <div className="grid gap-2 sm:grid-cols-2 text-[10px]">
                          <div className="rounded-lg border border-border bg-surface p-2">
                            <p className="font-semibold uppercase tracking-wide text-muted-text">
                              Home form
                            </p>
                            <p className="mt-1 text-main-text">
                              {selection.homeProbability
                                ?.toFixed(2)
                                ?.replace('0.', '.')}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-surface p-2">
                            <p className="font-semibold uppercase tracking-wide text-muted-text">
                              Away form
                            </p>
                            <p className="mt-1 text-main-text">
                              {selection.awayProbability?.toFixed(2)?.replace('0.', '.')}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-text pl-2">
                          {selection.qualityFlags.length > 0
                            ? `Data-quality flags: ${selection.qualityFlags
                                .map(f => f.replaceAll('_', ' ').toLowerCase())
                                .join(', ')}.`
                            : 'All data-quality gates passed.'}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-text pl-2">
                          Data as of:{' '}
                          {selection.dataAsOf ?? 'stored dataset'}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
                >
                  <Download className="h-4 w-4" />
                  Download bet slip
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-elevated-surface"
                >
                  {copied ? <Check className="h-4 w-4 text-accent" /> : <Share2 className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Share slip'}
                </button>
                {result ? (
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-elevated-surface"
                      aria-label="Share via apps"
                    >
                      <Share2 className="h-4 w-4" />
                      Share via apps
                    </button>
                    {showShareMenu ? (
                      <div className="absolute left-0 top-full mt-2 z-50 w-56 rounded-xl border border-border bg-surface/95 shadow-xl backdrop-blur-md p-2">
                        <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText(result))}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">WhatsApp</a>
                        <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(result))}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">Twitter / X</a>
                        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">Facebook</a>
                        <a href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(shareText(result))}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">Telegram</a>
                        <a href={`mailto:?subject=Predisha%20AI%20Prediction%20Slip&body=${encodeURIComponent(shareText(result))}`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">Email</a>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(shareText(result)).then(() => setCopied(true)); setTimeout(() => setCopied(false), 2000); setShowShareMenu(false); }} className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-main-text hover:bg-elevated-surface transition-colors">Copy link</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {result.slipId ? (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-accent">
                  <Check className="h-3.5 w-3.5" />
                  Saved to your prediction history with the probabilities used at build time.
                  <Link href="/history" className="inline-flex items-center gap-1 font-semibold hover:underline">
                    View history
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </p>
              ) : null}

              {result.limited ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5 text-[11px] text-accent">
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Free preview shows one selection and uses this account&apos;s only preview.
                  </span>
                  <Link href="/pricing" className="inline-flex items-center gap-1 font-semibold hover:underline">
                    See premium
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : null}

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-text">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                Probabilities are model estimates, not odds or guarantees, and are not betting
                advice. Combinations become less likely as selections are added.
              </p>

              {receipt ? (
                <div className="mt-5 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receipt} alt="Generated AI prediction bet slip" className="w-full" />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="mt-4 text-base font-semibold">Your slip will appear here</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-text">
                Choose a risk preference. We rank the fixtures that pass the model&apos;s quality
                gates and show the reasoning behind each pick.
              </p>
              {eligibleCount === 0 ? (
                <p className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px] text-muted-text">
                  <CircleAlert className="h-3.5 w-3.5" />
                  No upcoming fixtures currently pass the quality gates.
                </p>
              ) : (
                <p className="mt-4 text-[11px] text-muted-text">
                  {eligibleCount} upcoming fixture{eligibleCount === 1 ? '' : 's'} ready for analysis.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-border bg-surface/50 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <step.icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-text">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
