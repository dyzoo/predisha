'use client'

import { useState } from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'

type RouletteBet = 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'LOW' | 'HIGH' | 'NUMBER'

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

const OUTSIDE_BETS: Array<{ id: RouletteBet; label: string; multiplier: string }> = [
  { id: 'RED', label: 'Red', multiplier: '2x' },
  { id: 'BLACK', label: 'Black', multiplier: '2x' },
  { id: 'EVEN', label: 'Even', multiplier: '2x' },
  { id: 'ODD', label: 'Odd', multiplier: '2x' },
  { id: 'LOW', label: '1–18', multiplier: '2x' },
  { id: 'HIGH', label: '19–36', multiplier: '2x' },
]

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

interface RouletteOutcome {
  roll: number
  won: boolean
  multiplier: number
  payoutMinor: number
}

function numberColor(value: number): string {
  if (value === 0) return 'bg-emerald-500'
  return RED_NUMBERS.has(value) ? 'bg-red-500' : 'bg-neutral-800'
}

export function RouletteGame() {
  const { refreshWallet } = useBetSlip()
  const { mode } = useBetMode()
  const [stakeMinor, setStakeMinor] = useState(1_000)
  const [bet, setBet] = useState<RouletteBet>('RED')
  const [number, setNumber] = useState(7)
  const [outcome, setOutcome] = useState<RouletteOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function play() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/bet/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'roulette',
          stakeMinor,
          bet,
          ...(bet === 'NUMBER' ? { number } : {}),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        outcome?: RouletteOutcome
        error?: string
      }
      if (!response.ok || !payload.outcome) {
        setError(payload.error ?? 'The roulette round could not be played.')
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
          Roulette {mode === 'SANDBOX' ? 'Sandbox' : 'Live'}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Single-zero roulette</h1>
        <p className="mt-1 text-sm text-muted-text">
          Numbers 0–36. Outside bets pay 2x, a straight number pays 36x.
        </p>

        <div className="mt-6 flex h-44 flex-col items-center justify-center rounded-2xl border border-white/5 bg-background/40">
          {busy ? (
            <Loader2 className="h-9 w-9 animate-spin text-accent" />
          ) : outcome ? (
            <>
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white ${numberColor(outcome.roll)}`}
              >
                {outcome.roll}
              </div>
              <p
                className={`mt-3 text-sm font-semibold ${
                  outcome.won ? 'text-accent' : 'text-red-300'
                }`}
              >
                {outcome.won
                  ? `Won ${formatTzs(outcome.payoutMinor)} at ${outcome.multiplier}x`
                  : 'Lost this round'}
              </p>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent/30 bg-background text-2xl font-bold text-muted-text">
                ?
              </div>
              <p className="mt-3 text-sm text-muted-text">Choose a bet and spin.</p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-5">
        <label htmlFor="roulette-stake" className="text-xs font-medium text-muted-text">
          Stake (TZS)
        </label>
        <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
          <input
            id="roulette-stake"
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

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {OUTSIDE_BETS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBet(option.id)}
              className={`rounded-lg border px-2 py-2 text-[11px] font-semibold ${
                bet === option.id
                  ? 'border-accent bg-accent text-background'
                  : 'border-border text-muted-text hover:border-accent/40 hover:text-accent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setBet('NUMBER')}
          className={`mt-2 w-full rounded-lg border px-2 py-2 text-[11px] font-semibold ${
            bet === 'NUMBER'
              ? 'border-accent bg-accent text-background'
              : 'border-border text-muted-text hover:border-accent/40 hover:text-accent'
          }`}
        >
          Straight number · 36x
        </button>

        {bet === 'NUMBER' ? (
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="roulette-number" className="text-xs text-muted-text">
              Number
            </label>
            <input
              id="roulette-number"
              type="number"
              min={0}
              max={36}
              value={number}
              onChange={event => setNumber(Number(event.target.value))}
              className="w-24 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-accent/60"
            />
          </div>
        ) : null}

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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Spin for {formatTzs(stakeMinor)}
        </button>
        <p className="mt-3 text-[11px] text-muted-text">
          Single-zero wheel. No real money is involved.
        </p>
      </div>
    </div>
  )
}
