'use client'

import { useState } from 'react'
import { CircleAlert, Dices, Loader2 } from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

interface DiceOutcome {
  roll: number
  won: boolean
  multiplier: number
  payoutMinor: number
}

export function DiceGame() {
  const { refreshWallet } = useBetSlip()
  const [stakeMinor, setStakeMinor] = useState(1_000)
  const [target, setTarget] = useState(50)
  const [direction, setDirection] = useState<'OVER' | 'UNDER'>('OVER')
  const [outcome, setOutcome] = useState<DiceOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const winChance = direction === 'OVER' ? (100 - target) / 100 : target / 100
  const multiplier = Math.max(1.01, Math.round((0.97 / Math.max(0.01, winChance)) * 100) / 100)

  async function play() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/bet/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'dice', stakeMinor, target, direction }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        outcome?: DiceOutcome
        error?: string
      }
      if (!response.ok || !payload.outcome) {
        setError(payload.error ?? 'The dice round could not be played.')
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
          Dice · sandbox
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Roll over or under</h1>
        <p className="mt-1 text-sm text-muted-text">
          The server rolls 0.00–99.99. Win if the roll lands on your side of the target.
        </p>

        <div className="mt-6 flex h-44 flex-col items-center justify-center rounded-2xl border border-white/5 bg-background/40">
          {busy ? (
            <Loader2 className="h-9 w-9 animate-spin text-accent" />
          ) : outcome ? (
            <>
              <p className="text-5xl font-bold tabular-nums">{outcome.roll.toFixed(2)}</p>
              <p
                className={`mt-2 text-sm font-semibold ${
                  outcome.won ? 'text-accent' : 'text-red-300'
                }`}
              >
                {outcome.won
                  ? `Won ${formatTzs(outcome.payoutMinor)} at ${formatMultiplier(outcome.multiplier)}`
                  : 'Lost this round'}
              </p>
            </>
          ) : (
            <>
              <Dices className="h-10 w-10 text-muted-text" />
              <p className="mt-2 text-sm text-muted-text">Set your target and roll.</p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-5">
        <label htmlFor="dice-stake" className="text-xs font-medium text-muted-text">
          Stake (TZS)
        </label>
        <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
          <input
            id="dice-stake"
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

        <div className="mt-4 flex rounded-xl border border-border p-0.5">
          {(['OVER', 'UNDER'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                direction === option
                  ? 'bg-accent text-background'
                  : 'text-muted-text hover:text-main-text'
              }`}
            >
              Roll {option.toLowerCase()}
            </button>
          ))}
        </div>

        <label htmlFor="dice-target" className="mt-4 block text-xs font-medium text-muted-text">
          Target: {target.toFixed(2)}
        </label>
        <input
          id="dice-target"
          type="range"
          min={2}
          max={98}
          step={1}
          value={target}
          onChange={event => setTarget(Number(event.target.value))}
          className="mt-2 w-full accent-[#C8FF43]"
        />

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-background/40 p-3 text-center text-xs">
          <div>
            <p className="text-muted-text">Win chance</p>
            <p className="mt-0.5 font-semibold tabular-nums">{(winChance * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-text">Payout</p>
            <p className="mt-0.5 font-semibold text-accent tabular-nums">
              {formatTzs(Math.floor(stakeMinor * multiplier))}
            </p>
          </div>
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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
          Roll for {formatTzs(stakeMinor)}
        </button>
        <p className="mt-3 text-[11px] text-muted-text">
          Multiplier includes a 3% house edge. No real money is involved.
        </p>
      </div>
    </div>
  )
}
