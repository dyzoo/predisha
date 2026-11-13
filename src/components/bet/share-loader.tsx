'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  Lock,
  Share2,
  Smartphone,
} from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'
import type { BetSlipItem, TicketSelection } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

type BetMode = 'LIVE' | 'SANDBOX'
type SlipStatus = 'OPEN' | 'FROZEN' | 'CLOSED'
type EntryStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'

interface AdminSlip {
  id: string
  code: string
  title: string | null
  mode: BetMode
  status: SlipStatus
  frozen: boolean
  frozenReason: string | null
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  selections: TicketSelection[]
}

interface SlipEntry {
  id: string
  status: EntryStatus
  phoneMasked: string
  stakeMinor: number
  providerOrderId: string | null
  paidAt: string | null
  createdAt: string
  message: string
}

interface ShareResponse {
  share?: {
    code: string
    selections: TicketSelection[]
    expiresAt: string
    stale: boolean
  }
  slip?: AdminSlip
  error?: string
}

function toSlipItem(selection: TicketSelection): BetSlipItem {
  return {
    key: `${selection.fixtureId}:${selection.marketId}:${selection.selectionId}`,
    fixtureId: selection.fixtureId,
    marketId: selection.marketId,
    selectionId: selection.selectionId,
    odds: selection.odds,
    fixtureLabel: selection.fixtureLabel,
    competition: selection.competition,
    marketName: selection.marketName,
    selectionLabel: selection.selectionLabel,
    kickoffIso: selection.kickoffIso,
  }
}

function freezeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function statusClass(status: SlipStatus): string {
  if (status === 'OPEN') return 'border-accent/30 bg-accent/10 text-accent'
  if (status === 'FROZEN') return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  return 'border-red-400/30 bg-red-400/10 text-red-200'
}

export function ShareLoader({ code }: { code: string }) {
  const { viewer, setItemsFromShare } = useBetSlip()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [count, setCount] = useState(0)
  const [slip, setSlip] = useState<AdminSlip | null>(null)
  const [phone, setPhone] = useState('')
  const [paying, setPaying] = useState(false)
  const [entry, setEntry] = useState<SlipEntry | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as ShareResponse
        if (cancelled) return
        if (!response.ok || (!payload.share && !payload.slip)) {
          setState('error')
          setMessage(payload.error ?? 'That share link could not be loaded.')
          return
        }
        if (payload.slip) {
          setSlip(payload.slip)
          setCount(payload.slip.selections.length)
        }
        if (payload.share) {
          const items = payload.share.selections.map(toSlipItem)
          setItemsFromShare(items)
          setCount(items.length)
          setStale(payload.share.stale)
        }
        setState('ready')
      } catch {
        if (!cancelled) {
          setState('error')
          setMessage('Network error while loading the share link.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [code, setItemsFromShare])

  useEffect(() => {
    if (!entry || entry.status !== 'PENDING') return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/bet/share/entries/${encodeURIComponent(entry.id)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json().catch(() => ({}))) as { entry?: SlipEntry }
        if (!cancelled && payload.entry) setEntry(payload.entry)
      } catch {
        // keep polling until the provider responds
      }
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [entry])

  async function startPayment() {
    if (paying) return
    setPayError(null)
    const cleaned = phone.trim()
    if (cleaned.length < 7) {
      setPayError('Enter the mobile-money number you want to pay with.')
      return
    }
    setPaying(true)
    try {
      const response = await fetch('/api/bet/share/payment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, phone: cleaned }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        entry?: SlipEntry
        slip?: AdminSlip
      }
      if (!response.ok) {
        setPayError(payload.error ?? 'Could not start the payment.')
        return
      }
      if (payload.slip) setSlip(payload.slip)
      if (payload.entry) setEntry(payload.entry)
    } catch {
      setPayError('Network error. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (state !== 'ready') {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          {state === 'loading' ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <CircleAlert className="h-6 w-6" />
          )}
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          {state === 'loading' ? 'Loading shared slip…' : 'Share link unavailable'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          {message ?? 'Share codes expire after 24 hours.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/bet/sports" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background">
            Browse sportsbook
          </Link>
          <Link href="/bet" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40">
            Back to bet home
          </Link>
        </div>
      </div>
    )
  }

  if (!slip) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Share2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Shared slip loaded</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          {count} selection{count === 1 ? '' : 's'} added to your bet slip. Review the prices before
          placing a bet.
        </p>
        {stale ? (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            One or more prices changed since this slip was shared. Remove and re-add those selections
            from the sportsbook.
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/bet/sports" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background">
            Browse sportsbook
          </Link>
          <Link href="/bet" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40">
            Back to bet home
          </Link>
        </div>
      </div>
    )
  }

  const paid = entry?.status === 'PAID'
  const pending = entry?.status === 'PENDING'
  const failed = entry?.status === 'FAILED' || entry?.status === 'CANCELLED'
  const frozen = slip.frozen || slip.status !== 'OPEN'
  const canPay = !frozen && !paid && !pending
  const isSandbox = slip.mode === 'SANDBOX'

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-3xl border border-border bg-surface/80 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {isSandbox ? 'Sandbox slip' : 'Shared bet slip'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {slip.title ?? 'Bet slip'}
            </h1>
            <p className="mt-1 font-mono text-sm tracking-[0.24em] text-accent">{slip.code}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(slip.status)}`}>
            {slip.status}
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {slip.selections.map((selection, index) => (
            <li key={`${selection.fixtureId}:${selection.marketId}:${selection.selectionId}:${index}`} className="rounded-xl border border-border bg-background/40 px-3 py-2">
              <p className="text-sm font-semibold text-main-text">{selection.fixtureLabel}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-text">
                  {selection.marketName} · {selection.selectionLabel}
                </p>
                <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold tabular-nums text-accent">
                  {formatOdds(selection.odds)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-main-text">{formatTzs(slip.stakeMinor)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-main-text">{formatOdds(slip.totalOdds)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Payout</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-accent">{formatTzs(slip.potentialReturnMinor)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-[11px] text-muted-text">
          Betting closes automatically at {freezeLabel(slip.autoFreezeAt)}.
        </p>

        {frozen ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {slip.frozenReason ??
                'Betting is closed for this slip because a match has started or an administrator paused it.'}
            </span>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border bg-surface/80 p-6">
        {paid ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <CircleCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">Bet confirmed</h2>
            <p className="mt-1 text-sm text-muted-text">{entry?.message}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/bet/bets" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background">
                View my bets
              </Link>
              <Link href="/bet/sports" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40">
                Keep browsing
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Smartphone className="h-4 w-4 text-accent" />
              {isSandbox ? 'Confirm your number' : 'Confirm and pay'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-text">
              {isSandbox
                ? 'Enter the mobile number for this play-money slip to lock it in.'
                : 'Enter the mobile-money number. You will get a prompt to approve the payment, then the bet is placed automatically.'}
            </p>

            {!viewer.userId ? (
              <div className="mt-4 rounded-xl border border-border bg-background/40 p-3 text-center">
                <p className="text-xs text-muted-text">Sign in to take this slip.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Link href={`/sign-in?next=/bet/share/${slip.code}`} className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-background">
                    Sign in
                  </Link>
                  <Link href={`/sign-up?next=/bet/share/${slip.code}`} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-main-text hover:border-accent/40">
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Mobile number</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                    placeholder="07XX XXX XXX"
                    disabled={!canPay && !failed}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60 disabled:opacity-60"
                  />
                </label>

                {pending ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs text-accent">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for the mobile-money prompt on {entry?.phoneMasked ?? 'your phone'}…
                  </div>
                ) : null}

                {failed ? (
                  <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                    <CircleAlert className="h-4 w-4" />
                    {entry?.message ?? 'The payment did not complete. You can try again.'}
                  </p>
                ) : null}

                {payError ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {payError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={startPayment}
                  disabled={!canPay || paying || frozen}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  {paying
                    ? 'Starting payment…'
                    : isSandbox
                      ? `Confirm ${formatTzs(slip.stakeMinor)} slip`
                      : `Pay ${formatTzs(slip.stakeMinor)}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}