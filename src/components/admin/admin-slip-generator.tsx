'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Copy, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'

export interface GeneratorSelectionOption {
  selectionId: string
  label: string
  odds: number
}

export interface GeneratorMarket {
  id: string
  name: string
  selections: GeneratorSelectionOption[]
}

export interface GeneratorEvent {
  id: string
  label: string
  kickoffLabel: string
  status: string
  markets: GeneratorMarket[]
}

interface PickedSelection {
  fixtureId: string
  fixtureLabel: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: string
}

const MIN_ODDS = 1.01
const MAX_ODDS = 1000

interface CreateResponse {
  error?: string
  slip?: { code: string; shareUrl?: string; stakeMinor: number; totalOdds: number; potentialReturnMinor: number }
  shareUrl?: string
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

export function AdminSlipGenerator({ events }: { events: GeneratorEvent[] }) {
  const router = useRouter()
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [stake, setStake] = useState('1000')
  const [picked, setPicked] = useState<PickedSelection[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const activeEvent = useMemo(
    () => events.find(event => event.id === eventId) ?? null,
    [events, eventId],
  )

  const totalOdds = combinedOdds(picked)
  const stakeMinor = Number(stake)
  const potentialReturnMinor =
    Number.isFinite(stakeMinor) && stakeMinor > 0 && totalOdds > 0
      ? Math.floor(stakeMinor * totalOdds)
      : 0

  function addSelection(event: GeneratorEvent, market: GeneratorMarket, option: GeneratorSelectionOption) {
    setResult(null)
    setCopied(false)
    setPicked(current => {
      const withoutConflict = current.filter(
        item => !(item.fixtureId === event.id && item.marketId === market.id),
      )
      if (
        current.some(
          item =>
            item.fixtureId === event.id &&
            item.marketId === market.id &&
            item.selectionId === option.selectionId,
        )
      ) {
        return withoutConflict
      }
      return [
        ...withoutConflict,
        {
          fixtureId: event.id,
          fixtureLabel: event.label,
          marketId: market.id,
          marketName: market.name,
          selectionId: option.selectionId,
          selectionLabel: option.label,
          odds: option.odds.toFixed(2),
        },
      ]
    })
  }

  function updateOdds(index: number, odds: string) {
    setResult(null)
    setCopied(false)
    setPicked(current =>
      current.map((item, position) => (position === index ? { ...item, odds } : item)),
    )
  }

  function isPicked(eventId: string, marketId: string, selectionId: string): boolean {
    return picked.some(
      item =>
        item.fixtureId === eventId &&
        item.marketId === marketId &&
        item.selectionId === selectionId,
    )
  }

  function removeSelection(index: number) {
    setResult(null)
    setCopied(false)
    setPicked(current => current.filter((_, position) => position !== index))
  }

  async function onSubmit() {
    if (pending) return
    setError(null)
    setResult(null)
    setCopied(false)
    if (picked.length === 0) {
      setError('Add at least one selection to build a bet slip.')
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
    const absolute = link.startsWith('http')
      ? link
      : `${window.location.origin}${link}`
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
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
        <Sparkles className="h-4 w-4 text-accent" />
        Generate a bet slip
      </h2>
      <p className="mt-2 text-xs leading-relaxed">
        Choose upcoming fixtures, set the odds you want to offer, assign a stake and share the
        generated code. The customer sees the exact slip, confirms a phone number and pays with
        HarakaPay before the bet is locked in.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Slip title (optional)</span>
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

      <div className="mt-3">
        <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Fixture</span>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background/40 px-3 py-3 text-xs">
            No upcoming fixtures are available right now.
          </p>
        ) : (
          <select
            value={eventId}
            onChange={event => setEventId(event.target.value)}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {activeEvent ? (
        <div className="mt-3 space-y-3">
          {activeEvent.markets.map(market => (
            <div key={market.id} className="rounded-xl border border-border bg-background/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-text">
                {market.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {market.selections.map(option => {
                  const active = isPicked(activeEvent.id, market.id, option.selectionId)
                  return (
                    <button
                      key={option.selectionId}
                      type="button"
                      onClick={() => addSelection(activeEvent, market, option)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-accent/60 bg-accent/15 text-accent'
                          : 'border-border bg-surface text-main-text hover:border-accent/40'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className="rounded bg-background/60 px-1 tabular-nums text-muted-text">
                        {formatOdds(option.odds)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-text">
            Slip selections
          </p>
          <span className="text-[11px] text-muted-text">{picked.length} selected</span>
        </div>
        {picked.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-text">
             Tap odds above to add selections, then edit the price for each pick. One pick per
             market per fixture.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {picked.map((item, index) => (
              <li
                key={`${item.fixtureId}:${item.marketId}:${item.selectionId}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-main-text">{item.fixtureLabel}</p>
                  <p className="truncate text-[10px] text-muted-text">
                    {item.marketName} · {item.selectionLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_ODDS}
                    max={MAX_ODDS}
                    step={0.01}
                    value={item.odds}
                    onChange={event => updateOdds(index, event.target.value)}
                    aria-label={`Odds for ${item.selectionLabel}`}
                    className="w-16 rounded-md border border-border bg-background/60 px-1.5 py-1 text-right text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelection(index)}
                    aria-label="Remove selection"
                    className="shrink-0 rounded-md p-1 text-muted-text transition-colors hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {Number.isFinite(stakeMinor) ? formatTzs(stakeMinor) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {totalOdds > 0 ? formatOdds(totalOdds) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Payout</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-accent">
              {potentialReturnMinor > 0 ? formatTzs(potentialReturnMinor) : '—'}
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
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {pending ? 'Generating…' : 'Generate slip'}
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
              {copied ? <CircleCheck className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
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