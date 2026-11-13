'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Loader2, PauseCircle, Plane, TrendingUp } from 'lucide-react'
import type { AviatorConfig } from '@/lib/bet/aviator-config'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import type {
  AviatorBetView,
  AviatorRoundView,
  BetWalletView,
} from '@/lib/bet/types'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'

interface AviatorState {
  round: AviatorRoundView
  bets: AviatorBetView[]
  history: Array<{ roundId: string; crashAt: number }>
  wallet: BetWalletView
  config: AviatorConfig
}

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

export function AviatorGame() {
  const { refreshWallet } = useBetSlip()
  const { mode } = useBetMode()
  const [state, setState] = useState<AviatorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [stakeMinor, setStakeMinor] = useState(1_000)
  const [autoCashout, setAutoCashout] = useState('')
  const [slot, setSlot] = useState(1)
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(0)
  const [syncedAtMs, setSyncedAtMs] = useState<number | null>(null)
  const polling = useRef(false)

  const load = useCallback(async () => {
    if (polling.current) return
    polling.current = true
    try {
      const response = await fetch('/api/bet/games/aviator/state', { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as {
        state?: AviatorState
        error?: string
      }
      if (response.ok && payload.state) {
        setState(payload.state)
        setSyncedAtMs(Date.now())
        setLoadError(null)
      } else if (response.status !== 401) {
        setLoadError(payload.error ?? 'Could not load the Aviator round.')
      }
    } catch {
      setLoadError('Network error while loading Aviator.')
    } finally {
      polling.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 80)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 6_000)
    return () => clearTimeout(timer)
  }, [success])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function tick() {
      await load()
      if (!cancelled) timer = setTimeout(tick, 700)
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [load])

  const activeBet = state?.bets.find(bet => bet.slot === slot && bet.status === 'ACTIVE') ?? null
  const settledBet = state?.bets.find(bet => bet.slot === slot) ?? null
  const phase = state?.round.phase ?? 'WAITING'
  const config = state?.config
  const enabled = config?.enabled ?? true
  const drift = Math.max(0, clock - (syncedAtMs ?? clock))
  const multiplier =
    state && config
      ? phase === 'FLYING'
        ? Math.round(
            Math.min(
              state.round.crashAt,
              Math.exp(((state.round.flyElapsedMs + drift) / 1000) * config.growth),
            ) * 100,
          ) / 100
        : state.round.multiplier
      : 1
  const waitRemainingMs =
    state && phase === 'WAITING'
      ? Math.max(0, state.round.waitRemainingMs - drift)
      : 0
  const nextRoundMs =
    state && config && phase === 'CRASHED'
      ? Math.max(
          0,
          new Date(state.round.endsAtIso).getTime() -
            new Date(state.round.startsAtIso).getTime() -
            config.waitMs -
            state.round.flyElapsedMs -
            drift,
        )
      : 0
  const canBet = enabled && phase === 'WAITING' && !activeBet && !busy
  const canCashout = phase === 'FLYING' && Boolean(activeBet) && !busy
  const cashoutPreview = activeBet ? Math.floor(activeBet.stakeMinor * multiplier) : 0

  async function placeBet() {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const auto = Number.parseFloat(autoCashout)
      const response = await fetch('/api/bet/games/aviator/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeMinor,
          slot,
          ...(Number.isFinite(auto) && auto >= 1.1 ? { autoCashout: auto } : {}),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        bet?: AviatorBetView
        error?: string
      }
      if (!response.ok) {
        setError(payload.error ?? 'Could not place the Aviator bet.')
        return
      }
      setSuccess(
        `Seat ${payload.bet?.slot ?? slot} bet placed for ${formatTzs(
          payload.bet?.stakeMinor ?? stakeMinor,
        )}.`,
      )
      await load()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function cashout() {
    if (!activeBet) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/bet/games/aviator/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId: activeBet.id }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        bet?: AviatorBetView
        error?: string
      }
      if (!response.ok) {
        setError(payload.error ?? 'Cash out failed.')
        return
      }
      setSuccess(
        `Cashed out Seat ${payload.bet?.slot ?? activeBet.slot} at ${formatMultiplier(
          payload.bet?.cashedOutAt ?? multiplier,
        )} for ${formatTzs(payload.bet?.payoutMinor ?? 0)}.`,
      )
      await load()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const progress =
    phase === 'WAITING'
      ? Math.min(
          100,
          100 - (waitRemainingMs / Math.max(1, config?.waitMs ?? 5_000)) * 100,
        )
      : Math.min(100, ((multiplier - 1) / Math.max(0.1, (state?.round.crashAt ?? 2) - 1)) * 100)

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#1b2430] via-surface to-[#2a1b1f] p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Aviator {mode === 'SANDBOX' ? 'Sandbox' : 'Live'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Catch the multiplier</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {(state?.history ?? []).slice(0, 6).map(item => (
              <span
                key={item.roundId}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                  item.crashAt >= 2
                    ? 'bg-accent/15 text-accent'
                    : 'bg-red-400/15 text-red-300'
                }`}
              >
                {formatMultiplier(item.crashAt)}
              </span>
            ))}
          </div>
        </div>

        {!enabled ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Aviator betting is paused by the operator. You can watch rounds, but new bets are
            disabled until it reopens.
          </div>
        ) : null}

        <div className="relative mt-6 flex h-52 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-background/40">
          <div className="absolute inset-x-6 bottom-8 h-px bg-white/10" />
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          ) : (
            <>
              <div
                className="absolute transition-all duration-500 ease-out"
                style={{
                  left: `${Math.min(82, 8 + progress * 0.74)}%`,
                  bottom: `${Math.min(70, 12 + progress * 0.55)}%`,
                }}
              >
                <Plane
                  className={`h-8 w-8 -rotate-12 ${
                    phase === 'CRASHED' ? 'text-red-400' : 'text-accent'
                  }`}
                />
              </div>
              <div className="text-center">
                <p
                  className={`font-display text-5xl font-bold tabular-nums sm:text-6xl ${
                    phase === 'CRASHED' ? 'text-red-400' : 'text-main-text'
                  }`}
                >
                  {formatMultiplier(multiplier)}
                </p>
                <p className="mt-2 text-xs font-medium text-muted-text">
                  {phase === 'WAITING'
                    ? `Betting closes in ${(waitRemainingMs / 1000).toFixed(1)}s`
                    : phase === 'FLYING'
                      ? 'Flying · cash out before it crashes'
                      : `Crashed at ${formatMultiplier(
                          state?.round.crashAt ?? multiplier,
                        )} · next round in ${(nextRoundMs / 1000).toFixed(1)}s`}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              phase === 'CRASHED' ? 'bg-red-400' : 'bg-accent'
            }`}
            style={{ width: `${Math.max(2, progress)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Place a bet</h2>
            <div className="flex rounded-lg border border-border p-0.5">
              {[1, 2].map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setSlot(candidate)}
                  className={`rounded-md px-3 py-1 text-[11px] font-semibold ${
                    slot === candidate
                      ? 'bg-accent text-background'
                      : 'text-muted-text hover:text-main-text'
                  }`}
                >
                  Seat {candidate}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="aviator-stake" className="text-xs font-medium text-muted-text">
                Stake (TZS)
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
                <input
                  id="aviator-stake"
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
            </div>
            <div>
              <label htmlFor="aviator-auto" className="text-xs font-medium text-muted-text">
                Auto cash out (optional)
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
                <input
                  id="aviator-auto"
                  type="number"
                  min={1.1}
                  max={config?.maxCrash ?? 100}
                  step={0.1}
                  placeholder="e.g. 2.00"
                  value={autoCashout}
                  onChange={event => setAutoCashout(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none placeholder:text-muted-text/60"
                />
                <span className="text-xs text-muted-text">x</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-text">
                The server settles auto cash out as the round flies.
              </p>
            </div>
          </div>

          {error || loadError ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error ?? loadError}
            </div>
          ) : null}
          {success ? (
            <div
              role="status"
              className="mt-3 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent"
            >
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {success}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={placeBet}
              disabled={!canBet}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && !activeBet ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!enabled
                ? 'Betting paused'
                : activeBet
                  ? `Seat ${slot} is in play`
                  : phase === 'WAITING'
                    ? `Bet ${formatTzs(stakeMinor)}`
                    : 'Waiting for next round'}
            </button>
            <button
              type="button"
              onClick={cashout}
              disabled={!canCashout}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && activeBet ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {activeBet && phase === 'FLYING'
                ? `Cash out ${formatTzs(cashoutPreview)}`
                : 'Cash out'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-5">
          <h2 className="text-sm font-semibold">This round</h2>
          {state?.bets.length ? (
            <ul className="mt-3 space-y-2">
              {state.bets.map(bet => (
                <li
                  key={bet.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold">Seat {bet.slot}</p>
                    <p className="text-[11px] text-muted-text">
                      {formatTzs(bet.stakeMinor)}
                      {bet.autoCashout ? ` · auto ${formatMultiplier(bet.autoCashout)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        bet.status === 'LOST' ? 'text-red-300' : 'text-accent'
                      }`}
                    >
                      {bet.status === 'ACTIVE'
                        ? `In play · ${formatTzs(Math.floor(bet.stakeMinor * multiplier))}`
                        : bet.status === 'CASHED_OUT'
                          ? `${formatMultiplier(bet.cashedOutAt ?? 1)} · ${formatTzs(bet.payoutMinor)}`
                          : 'Lost'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-text">
              No bets in this round. Choose a seat and place a bet while the timer is
              counting down.
            </p>
          )}

          {settledBet && settledBet.status !== 'ACTIVE' ? (
            <p className="mt-3 rounded-xl bg-background/40 px-3 py-2 text-[11px] text-muted-text">
              Last seat {settledBet.slot} result: {settledBet.status.toLowerCase()} at{' '}
              {formatMultiplier(settledBet.cashedOutAt ?? 1)}.
            </p>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-muted-text">
            Rounds are deterministic {((config?.roundMs ?? 30_000) / 1000).toFixed(0)}-second
            cycles with a {((config?.waitMs ?? 6_000) / 1000).toFixed(0)}-second betting window.
            The crash point is committed server-side, so the browser cannot change the outcome.
          </p>
        </div>
      </div>
    </div>
  )
}
