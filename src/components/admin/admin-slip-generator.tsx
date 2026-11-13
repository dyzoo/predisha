'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleAlert,
  CircleCheck,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type {
  AdminRecommendationPick,
  AdminSlipRecommendation,
} from '@/lib/bet/recommendation'
import { formatOdds, formatTzs } from '@/lib/bet/format'

type PickedSelection = Omit<AdminRecommendationPick, 'odds'> & {
  odds: string
}

const MIN_ODDS = 1.01
const MAX_ODDS = 1000

interface CreateResponse {
  error?: string
  slip?: {
    code: string
    shareUrl?: string
    stakeMinor: number
    totalOdds: number
    potentialReturnMinor: number
  }
  shareUrl?: string
}

function toPicked(picks: AdminRecommendationPick[]): PickedSelection[] {
  return picks.map(pick => ({ ...pick, odds: pick.odds.toFixed(2) }))
}

function combinedOdds(picked: PickedSelection[]): number {
  if (picked.length === 0) return 0
  const product = picked.reduce((total, item) => total * Number(item.odds || 0), 1)
  return Math.max(1, Math.round(product * 100) / 100)
}

function validOdds(odds: string): boolean {
  const value = Number(odds)
  return Number.isFinite(value) && value >= MIN_ODDS && value <= MAX_ODDS
}

function generatedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'just now'
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function AdminSlipGenerator({
  recommendation,
}: {
  recommendation: AdminSlipRecommendation
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [stake, setStake] = useState('1000')
  const [picked, setPicked] = useState<PickedSelection[]>(() => toPicked(recommendation.picks))
  const [generatedAt, setGeneratedAt] = useState(recommendation.generatedAt)
  const [demo, setDemo] = useState(recommendation.demo)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const totalOdds = combinedOdds(picked)
  const stakeMinor = Number(stake)
  const potentialReturnMinor =
    Number.isFinite(stakeMinor) && stakeMinor > 0 && totalOdds > 0
      ? Math.floor(stakeMinor * totalOdds)
      : 0

  function updateOdds(index: number, odds: string) {
    setResult(null)
    setCopied(false)
    setPicked(current =>
      current.map((item, position) => (position === index ? { ...item, odds } : item)),
    )
  }

  async function refreshPicks() {
    if (refreshing || pending) return
    setRefreshing(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/admin/bets/recommendation', {
        cache: 'no-store',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as
        | AdminSlipRecommendation
        | { error?: string }
      if (!response.ok || !('picks' in payload)) {
        setError(('error' in payload && payload.error) || 'Could not refresh the model picks.')
        return
      }
      setPicked(toPicked(payload.picks))
      setGeneratedAt(payload.generatedAt)
      setDemo(payload.demo)
    } catch {
      setError('Network error while refreshing the model picks.')
    } finally {
      setRefreshing(false)
    }
  }

  async function onSubmit() {
    if (pending) return
    setError(null)
    setResult(null)
    setCopied(false)
    if (picked.length === 0) {
      setError('The model has no eligible picks right now. Refresh in a moment.')
      return
    }
    if (!Number.isInteger(stakeMinor) || stakeMinor < 500 || stakeMinor > 500_000) {
      setError('Stake must be a whole amount between 500 and 500,000 TZS.')
      return
    }
    if (picked.some(item => !validOdds(item.odds))) {
      setError(`Each odd must be between ${MIN_ODDS} and ${MAX_ODDS}.`)
      return
    }
    setPending(true)
    try {
      const response = await fetch('/api/admin/bets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() ? title.trim() : undefined,
          stakeMinor,
          selections: picked.map(item => ({
            fixtureId: item.fixtureId,
            marketId: item.marketId,
            selectionId: item.selectionId,
            odds: Number(item.odds),
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as CreateResponse
      if (!response.ok || !payload.slip) {
        setError(payload.error ?? 'Could not generate this bet slip.')
        return
      }
      const shareUrl =
        payload.shareUrl ?? payload.slip.shareUrl ?? `/bet/share/${payload.slip.code}`
      setResult({ ...payload, shareUrl })
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function copyLink() {
    const link = result?.shareUrl
    if (!link) return
    const absolute = link.startsWith('http') ? link : `${window.location.origin}${link}`
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const absoluteShare = result?.shareUrl
    ? result.shareUrl.startsWith('http')
      ? result.shareUrl
      : `${typeof window !== 'undefined' ? window.location.origin : ''}${result.shareUrl}`
    : ''

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
            <Sparkles className="h-4 w-4 text-accent" />
            AI slip generator
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-text">
            The model ranks the best upcoming value picks across at least 15 matches. You only
            adjust the odds you want to offer, then assign a stake and share the code.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshPicks}
          disabled={refreshing || pending}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? 'Refreshing...' : 'Refresh AI picks'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
            Slip title (optional)
          </span>
          <input
            type="text"
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={120}
            placeholder="e.g. Weekend banker"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
          />
        </label>
        <label className="block sm:w-40">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Stake (TZS)</span>
          <input
            type="number"
            inputMode="numeric"
            min={500}
            max={500000}
            step={100}
            value={stake}
            onChange={event => setStake(event.target.value)}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
          />
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-text">
            Model picks
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-text">
            {demo ? (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-200">
                Demo data
              </span>
            ) : null}
            <span>{picked.length} matches</span>
            <span className="text-muted-text/60">{generatedLabel(generatedAt)}</span>
          </div>
        </div>

        {picked.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-background/40 px-3 py-3 text-xs text-muted-text">
            No upcoming fixtures pass the model quality gates right now. Refresh or try after the
            next data sync.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {picked.map((item, index) => (
              <li
                key={item.fixtureId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-main-text">
                    {index + 1}. {item.fixtureLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-text">
                    {item.competition} | {item.kickoffLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-accent">
                    {item.marketName}: {item.selectionLabel} | {Math.round(item.probability * 100)}%
                    model probability
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-text">Odds</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_ODDS}
                    max={MAX_ODDS}
                    step={0.01}
                    value={item.odds}
                    onChange={event => updateOdds(index, event.target.value)}
                    aria-label={`Odds for ${item.selectionLabel} in ${item.fixtureLabel}`}
                    className="w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}

        {picked.length > 0 && picked.length < 15 ? (
          <p className="mt-3 text-[10px] text-amber-200">
            Only {picked.length} fixtures pass the model gates right now. The generator targets 15
            or more when the schedule allows.
          </p>
        ) : null}

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {Number.isFinite(stakeMinor) ? formatTzs(stakeMinor) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {totalOdds > 0 ? formatOdds(totalOdds) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Payout</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-accent">
              {potentialReturnMinor > 0 ? formatTzs(potentialReturnMinor) : '-'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || picked.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {pending ? 'Generating...' : 'Generate slip'}
        </button>
        {error ? (
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : null}
      </div>

      {result?.slip ? (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
            <CircleCheck className="h-3.5 w-3.5" />
            Slip generated
          </p>
          <p className="mt-2 text-xs text-main-text">
            Slip code:{' '}
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-accent">
              {result.slip.code}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-lg border border-border bg-background/60 px-2 py-1 text-[10px] text-muted-text">
              {absoluteShare}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40"
            >
              {copied ? (
                <CircleCheck className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={result.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-accent hover:underline"
            >
              Open share page
            </a>
          </div>
        </div>
      ) : null}
    </section>
  )
}
