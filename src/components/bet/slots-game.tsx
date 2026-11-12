'use client'

import { useState } from 'react'
import { CircleAlert, Loader2, Sparkles } from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

const SYMBOLS: Record<string, { label: string; className: string }> = {
  seven: { label: '7', className: 'text-red-300' },
  bar: { label: 'BAR', className: 'text-sky-300' },
  bell: { label: 'BELL', className: 'text-amber-300' },
  cherry: { label: 'CHERRY', className: 'text-rose-300' },
  lemon: { label: 'LEMON', className: 'text-accent' },
}

interface SlotsOutcome {
  reels: string[]
  multiplier: number
  payoutMinor: number
}

export function SlotsGame() {
  const { refreshWallet } = useBetSlip()
  const [stakeMinor, setStakeMinor] = useState(1_000)
  const [outcome, setOutcome] = useState<SlotsOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reels = outcome?.reels ?? ['lemon', 'cherry', 'bell']

  async function play() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/bet/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'slots', stakeMinor }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        outcome?: SlotsOutcome
        error?: string
      }
      if (!response.ok || !payload.outcome) {
        setError(payload.error ?? 'The slots round could not be played.')
        return
      }
      setOutcome(payload.outcome)
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-accent/10 p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Slots · sandbox
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Three-reel arcade</h1>
        <p className="mt-1 text-sm text-muted-text">
          Match three symbols for the biggest payouts. Two cherries pay 2x.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-background/40 p-4">
          {reels.map((symbol, index) => {
            const meta = SYMBOLS[symbol] ?? { label: symbol.toUpperCase(), className: 'text-main-text' }
            return (
              <div
                key={`${symbol}-${index}`}
                className="flex h-28 items-center justify-center rounded-xl border border-border bg-surface text-center"
              >
                {busy ? (
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                ) : (
                  <span className={`font-display text-xl font-bold tracking-tight ${meta.className}`}>
                    {meta.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {outcome ? (
          <p
            className={`mt-3 text-center text-sm font-semibold ${
              outcome.payoutMinor > 0 ? 'text-accent' : 'text-red-300'
            }`}
          >
            {outcome.payoutMinor > 0
              ? `Won ${formatTzs(outcome.payoutMinor)} at ${formatMultiplier(outcome.multiplier)}`
              : 'No win this spin'}
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-muted-text">
            Seven pays 50x · BAR 20x · BELL 10x · CHERRY 6x · LEMON 4x
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-5">
        <label htmlFor="slots-stake" className="text-xs font-medium text-muted-text">
          Stake (TZS)
        </label>
        <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
          <input
            id="slots-stake"
            type="number"
            min={MIN_STAKE_MINOR}
            step={500}
            value={stakeMinor}
            onChange={event => setStakeMinor(Number(event.target.value))}
            className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {QUICK_STAKES.map(amount => (
            <button
              key={amount}
              type="button"
              onClick={() => setStakeMinor(amount)}
              className="rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold text-muted-text hover:border-accent/40 hover:text-accent"
            >
              {formatTzs(amount)}
            </button>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={play}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Spin for {formatTzs(stakeMinor)}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-text">
          Symbols are weighted server-side. This is a play-money arcade, not a real slot machine.
        </p>
      </div>
    </div>
  )
}
