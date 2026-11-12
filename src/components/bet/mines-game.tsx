'use client'

import { useState } from 'react'
import {
  Bomb,
  Check,
  CircleAlert,
  Coins,
  Gem,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import type { BetGameRoundView } from '@/lib/bet/types'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

interface MinesDetail {
  mines?: number
  revealed?: number[]
  multiplier?: number
  safeRemaining?: number
  minePositions?: number[]
}

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

export function MinesGame() {
  const { refreshWallet } = useBetSlip()
  const [round, setRound] = useState<BetGameRoundView | null>(null)
  const [stakeMinor, setStakeMinor] = useState(1_000)
  const [mines, setMines] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const detail = (round?.detail ?? {}) as MinesDetail
  const revealed = new Set(detail.revealed ?? [])
  const minePositions = new Set(detail.minePositions ?? [])
  const multiplier = detail.multiplier ?? 1
  const safeRemaining = detail.safeRemaining ?? 25 - mines
  const open = round?.status === 'OPEN'
  const finished = Boolean(round && round.status !== 'OPEN')
  const potential = Math.floor((round?.stakeMinor ?? stakeMinor) * multiplier)

  async function call<T>(url: string, body: Record<string, unknown>): Promise<T | null> {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'The mines round could not be updated.')
        return null
      }
      await refreshWallet()
      return payload
    } catch {
      setError('Network error. Please try again.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    const payload = await call<{ round: BetGameRoundView }>('/api/bet/games/mines/start', {
      stakeMinor,
      mines,
    })
    if (payload?.round) {
      setRound(payload.round)
      setMessage('Round started. Pick a tile to reveal.')
    }
  }

  async function reveal(tile: number) {
    if (!round || !open || revealed.has(tile) || busy) return
    const payload = await call<{
      round: BetGameRoundView
      hitMine: boolean
      autoCashedOut: boolean
      multiplier: number
    }>('/api/bet/games/mines/reveal', { roundId: round.id, tile })
    if (!payload?.round) return
    setRound(payload.round)
    if (payload.hitMine) setMessage('You hit a mine. Start a new round.')
    else if (payload.autoCashedOut) {
      setMessage(`Cleared the board at ${formatMultiplier(payload.multiplier)}.`)
    }
  }

  async function cashout() {
    if (!round || !open) return
    const payload = await call<{ round: BetGameRoundView; multiplier: number }>(
      '/api/bet/games/mines/cashout',
      { roundId: round.id },
    )
    if (payload?.round) {
      setRound(payload.round)
      setMessage(`Cashed out at ${formatMultiplier(payload.multiplier)}.`)
    }
  }

  function reset() {
    setRound(null)
    setMessage(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-accent/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Mines · sandbox
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Reveal gems, avoid mines</h1>
            <p className="mt-1 text-sm text-muted-text">
              5×5 grid. Mines are placed server-side before your first reveal.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-text">Multiplier</p>
            <p className="text-2xl font-bold text-accent tabular-nums">
              {formatMultiplier(round ? multiplier : 1)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-text">
            <span>{round ? `${revealed.size} revealed` : 'Ready to start'}</span>
            <span>{round ? `${safeRemaining} safe tiles left` : `${mines} mines`}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }, (_, index) => {
              const isRevealed = revealed.has(index)
              const isMine = minePositions.has(index)
              const showMine = isMine && (isRevealed || finished)
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => reveal(index)}
                  disabled={!round || !open || isRevealed || busy}
                  aria-label={`Tile ${index + 1}`}
                  className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                    showMine
                      ? 'border-red-400/40 bg-red-400/15 text-red-300'
                      : isRevealed
                        ? 'border-accent/40 bg-accent/15 text-accent'
                        : round && open
                          ? 'border-border bg-background/50 hover:border-accent/50 hover:bg-accent/10'
                          : 'border-border bg-background/30 text-muted-text/50'
                  }`}
                >
                  {showMine ? (
                    <Bomb className="h-5 w-5" />
                  ) : isRevealed ? (
                    <Gem className="h-5 w-5" />
                  ) : (
                    <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
                  )}
                </button>
              )
            })}
          </div>

          {message ? (
            <p className="mt-3 rounded-xl bg-background/40 px-3 py-2 text-xs text-accent">{message}</p>
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
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/80 p-5">
            {round ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-background/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {formatTzs(round.stakeMinor)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-text">
                      Cash out value
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-accent tabular-nums">
                      {formatTzs(finished ? round.payoutMinor : potential)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cashout}
                  disabled={!open || revealed.size === 0 || busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                  Cash out {open ? formatTzs(potential) : ''}
                </button>

                {finished ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-text hover:border-accent/40 hover:text-accent"
                  >
                    <RotateCcw className="h-4 w-4" />
                    New round
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <label htmlFor="mines-stake" className="text-xs font-medium text-muted-text">
                  Stake (TZS)
                </label>
                <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
                  <input
                    id="mines-stake"
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

                <label htmlFor="mines-count" className="mt-4 block text-xs font-medium text-muted-text">
                  Mines: {mines}
                </label>
                <input
                  id="mines-count"
                  type="range"
                  min={1}
                  max={24}
                  value={mines}
                  onChange={event => setMines(Number(event.target.value))}
                  className="mt-2 w-full accent-[#C8FF43]"
                />

                <button
                  type="button"
                  onClick={start}
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Start round · {formatTzs(stakeMinor)}
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-5 text-[11px] leading-relaxed text-muted-text">
            <p className="font-semibold text-main-text">How the sandbox payout works</p>
            <p className="mt-1">
              Each safe tile increases the multiplier using the remaining safe-tile probability with a
              3% house edge. A mine ends the round immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
