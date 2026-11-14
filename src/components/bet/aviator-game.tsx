'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  PauseCircle,
  Plane,
  Radio,
  TrendingUp,
} from 'lucide-react'
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

interface BetPanelState {
  stakeMinor: number
  autoCashout: string
}

type Slot = 1 | 2

const QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]

interface FlightPoint {
  x: number
  y: number
  progress: number
}

function aviatorPoint(multiplier: number, crashAt: number): FlightPoint {
  const crash = Math.max(crashAt, 1.01)
  const value = Math.min(Math.max(multiplier, 1), crash)
  const progress = Math.log(value) / Math.log(crash)
  const x = 44 + progress * (600 - 88)
  const y =
    232 -
    Math.pow(Math.max(0, (value - 1) / Math.max(0.0001, crash - 1)), 1.35) * 180
  return { x, y, progress }
}

function flightPoint(multiplier: number, crashAt: number) {
  const point = aviatorPoint(multiplier, crashAt)
  return { x: point.x, y: point.y }
}

function flightTrail(multiplier: number, crashAt: number) {
  const endMultiplier = Math.min(Math.max(multiplier, 1), Math.max(crashAt, 1.01))
  const end = aviatorPoint(endMultiplier, crashAt)
  const steps = Math.max(2, Math.round(end.progress * 40))
  const points: FlightPoint[] = []
  for (let index = 0; index <= steps; index += 1) {
    const value = 1 + (endMultiplier - 1) * (index / steps)
    points.push(aviatorPoint(value, crashAt))
  }
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
}

const SPORTS_NAV = [
  { href: '/bet/sports', label: 'Football' },
  { href: '/bet/sports?view=upcoming', label: 'Upcoming' },
  { href: '/bet/live', label: 'In-Play' },
  { href: '/bet/sports', label: 'All Sports' },
  { href: '/bet/bets', label: 'My Bets' },
  { href: '#multiplier-history', label: 'Multiplier History' },
] as const

export function AviatorGame() {
  const { refreshWallet } = useBetSlip()
  const { mode } = useBetMode()
  const [state, setState] = useState<AviatorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [panels, setPanels] = useState<Record<Slot, BetPanelState>>({
    1: { stakeMinor: 1_000, autoCashout: '' },
    2: { stakeMinor: 1_000, autoCashout: '' },
  })
  const [busySlot, setBusySlot] = useState<number | null>(null)
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
  const activeBets = state?.bets.filter(bet => bet.status === 'ACTIVE') ?? []

  const activeBetFor = (slot: Slot) =>
    state?.bets.find(bet => bet.slot === slot && bet.status === 'ACTIVE') ?? null
  const settledBetFor = (slot: Slot) =>
    state?.bets.find(bet => bet.slot === slot && bet.status !== 'ACTIVE') ?? null

  function updatePanel(slot: Slot, patch: Partial<BetPanelState>) {
    setPanels(current => ({ ...current, [slot]: { ...current[slot], ...patch } }))
  }

  async function placeBet(slot: Slot) {
    const panel = panels[slot]
    setBusySlot(slot)
    setError(null)
    setSuccess(null)
    try {
      const auto = Number.parseFloat(panel.autoCashout)
      const response = await fetch('/api/bet/games/aviator/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeMinor: panel.stakeMinor,
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
        `Bet ${payload.bet?.slot ?? slot} placed for ${formatTzs(
          payload.bet?.stakeMinor ?? panel.stakeMinor,
        )}.`,
      )
      await load()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusySlot(null)
    }
  }

  async function cashout(bet: AviatorBetView) {
    setBusySlot(bet.slot)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/bet/games/aviator/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId: bet.id }),
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
        `Cashed out Bet ${payload.bet?.slot ?? bet.slot} at ${formatMultiplier(
          payload.bet?.cashedOutAt ?? multiplier,
        )} for ${formatTzs(payload.bet?.payoutMinor ?? 0)}.`,
      )
      await load()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusySlot(null)
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
      <nav
        aria-label="Aviator sports navigation"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/70 p-1"
      >
        {SPORTS_NAV.map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold text-muted-text transition-colors hover:bg-background/50 hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {error || loadError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error ?? loadError}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </div>
      ) : null}

      <div
        id="multiplier-history"
        className="rounded-2xl border border-border bg-surface/80 p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-text">
            Multiplier history
          </p>
          <p className="text-[10px] text-muted-text">Latest rounds</p>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {(state?.history ?? []).length === 0 ? (
            <span className="px-2 py-1 text-xs text-muted-text">No rounds yet.</span>
          ) : (
            (state?.history ?? []).slice(0, 18).map(item => (
              <span
                key={item.roundId}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums ${
                  item.crashAt >= 2
                    ? 'bg-accent/15 text-accent'
                    : 'bg-red-400/15 text-red-300'
                }`}
              >
                {formatMultiplier(item.crashAt)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-[#0b0f14] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
              </span>
              Live Aviator
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Catch the multiplier</h1>
            <p className="mt-1 text-xs text-muted-text">
              {mode === 'SANDBOX' ? 'Sandbox' : 'Live'} mode · server-side crash points
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-text">Active bets</p>
            <p className="text-xl font-bold tabular-nums text-accent">{activeBets.length}</p>
          </div>
        </div>

        {!enabled ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Aviator betting is paused by the operator. You can watch rounds, but new bets are
            disabled until it reopens.
          </div>
        ) : null}

        <div className="relative mt-6 h-[22rem] overflow-hidden rounded-2xl border border-red-400/20 bg-[radial-gradient(circle_at_70%_20%,rgba(239,68,68,0.18),transparent_55%),radial-gradient(circle_at_20%_85%,rgba(251,146,60,0.12),transparent_60%),#0a0e14] sm:h-[26rem]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
          <svg
            aria-hidden="true"
            viewBox="0 0 600 280"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="aviatorFlight" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fdba74" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {Array.from({ length: 8 }, (_, index) => (
              <line
                key={`h-${index}`}
                x1="0"
                y1={28 + index * 32}
                x2="600"
                y2={28 + index * 32}
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 12 }, (_, index) => (
              <line
                key={`v-${index}`}
                x1={index * 50}
                y1="0"
                x2={index * 50}
                y2="280"
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="1"
              />
            ))}
            {(() => {
              const crashAt = state?.round.crashAt ?? multiplier
              const trail = flightTrail(multiplier, crashAt)
              const end = flightPoint(multiplier, crashAt)
              return (
                <>
                  {trail ? (
                    <path
                      d={`${trail} L ${end.x.toFixed(1)} 232 L 44 232 Z`}
                      fill="url(#aviatorFlight)"
                      fillOpacity="0.14"
                    />
                  ) : null}
                  <path
                    d={trail || 'M 44 232'}
                    fill="none"
                    stroke="url(#aviatorFlight)"
                    strokeWidth="10"
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={trail || 'M 44 232'}
                    fill="none"
                    stroke="url(#aviatorFlight)"
                    strokeWidth="3"
                    strokeOpacity={phase === 'CRASHED' ? 0.6 : 0.95}
                    strokeLinecap="round"
                  />
                </>
              )
            })()}
          </svg>
          <div className="absolute inset-x-8 bottom-6 h-px bg-white/10" />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-red-400" />
            </div>
          ) : (
            <>
              {(() => {
                const crashAt = state?.round.crashAt ?? multiplier
                const point = flightPoint(multiplier, crashAt)
                const ahead = flightPoint(Math.min(crashAt, multiplier * 1.03), crashAt)
                const angle =
                  (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI
                return (
                  <div
                    className={`absolute transition-transform duration-150 ease-out ${
                      phase === 'CRASHED' ? 'opacity-40' : 'opacity-100'
                    }`}
                    style={{
                      left: `${(point.x / 600) * 100}%`,
                      top: `${(232 - point.y) / 280 * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    }}
                  >
                    <svg
                      viewBox="0 0 64 64"
                      className={`h-16 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_18px_rgba(239,68,68,0.65)] ${
                        phase === 'CRASHED' ? 'text-red-500' : 'text-orange-400'
                      }`}
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M58.6 27.3 40.2 22 34.4 7.2c-.6-1.5-1.9-2.6-3.5-2.9l-2.3-.4c-1.4-.2-2.5 1.2-1.9 2.5l5.6 14.3-12.5-3.3-4.6-7.9c-.5-.9-1.4-1.4-2.4-1.5l-2.4-.2c-1.1-.1-1.9 1-1.6 2l3.3 12.6-5.6 2.1c-1.4.5-2.3 1.8-2.3 3.3v1.7c0 1.5.9 2.8 2.3 3.3l5.6 2.1-3.3 12.6c-.3 1 .5 2.1 1.6 2l2.4-.2c1-.1 1.9-.6 2.4-1.5l4.6-7.9 12.5-3.3-5.6 14.3c-.6 1.4.5 2.7 1.9 2.5l2.3-.4c1.6-.3 2.9-1.4 3.5-2.9l5.8-14.8 18.4-5.3c1.9-.5 3.2-2.2 3.2-4.1v-.5c0-1.9-1.3-3.6-3.2-4.1Z" />
                    </svg>
                  </div>
                )
              })()}
              <div className="relative flex h-full flex-col items-center justify-center text-center">
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
                      ? 'Flying - cash out before it crashes'
                      : `Crashed at ${formatMultiplier(
                          state?.round.crashAt ?? multiplier,
                        )} - next round in ${(nextRoundMs / 1000).toFixed(1)}s`}
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

      <div className="grid gap-3 md:grid-cols-2">
        {([1, 2] as const).map(candidate => {
          const slot = candidate as Slot
          const panel = panels[slot]
          const activeBet = activeBetFor(slot)
          const settledBet = settledBetFor(slot)
          const busy = busySlot === slot
          const canBet = enabled && phase === 'WAITING' && !activeBet && busySlot === null
          const canCashout = phase === 'FLYING' && Boolean(activeBet) && busySlot === null
          const cashoutPreview = activeBet
            ? Math.floor(activeBet.stakeMinor * multiplier)
            : 0
          const disabled = activeBet ? !canCashout : !canBet
          const label = !enabled
            ? 'Betting paused'
            : activeBet
              ? phase === 'FLYING'
                ? `Cash out ${formatTzs(cashoutPreview)}`
                : `Bet ${slot} in play`
              : phase === 'WAITING'
                ? `Bet ${formatTzs(panel.stakeMinor)}`
                : 'Next round'

          return (
            <div
              key={slot}
              className="rounded-2xl border border-border bg-surface/80 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold">Bet {slot}</h2>
                {activeBet ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                    <Radio className="h-3 w-3 animate-pulse" />
                    In play
                  </span>
                ) : settledBet ? (
                  <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-text">
                    Last: {settledBet.status.toLowerCase()}
                  </span>
                ) : (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Next round
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={`aviator-stake-${slot}`}
                    className="text-[10px] font-medium uppercase tracking-wide text-muted-text"
                  >
                    Stake (TZS)
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-border bg-background/50 px-2.5 focus-within:border-accent/60">
                    <input
                      id={`aviator-stake-${slot}`}
                      type="number"
                      min={MIN_STAKE_MINOR}
                      step={500}
                      value={panel.stakeMinor}
                      onChange={event =>
                        updatePanel(slot, { stakeMinor: Number(event.target.value) })
                      }
                      className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor={`aviator-auto-${slot}`}
                    className="text-[10px] font-medium uppercase tracking-wide text-muted-text"
                  >
                    Auto cash out
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-border bg-background/50 px-2.5 focus-within:border-accent/60">
                    <input
                      id={`aviator-auto-${slot}`}
                      type="number"
                      min={1.1}
                      max={config?.maxCrash ?? 100}
                      step={0.1}
                      placeholder="2.00"
                      value={panel.autoCashout}
                      onChange={event =>
                        updatePanel(slot, { autoCashout: event.target.value })
                      }
                      className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none placeholder:text-muted-text/60"
                    />
                    <span className="text-xs text-muted-text">x</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {QUICK_STAKES.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => updatePanel(slot, { stakeMinor: amount })}
                    className="rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold text-muted-text hover:border-accent/40 hover:text-accent"
                  >
                    {formatTzs(amount)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={
                  activeBet
                    ? () => {
                        void cashout(activeBet)
                      }
                    : () => {
                        void placeBet(slot)
                      }
                }
                disabled={disabled}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeBet ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <Plane className="h-4 w-4" />
                )}
                {label}
              </button>

              <p className="mt-2 text-[10px] leading-relaxed text-muted-text">
                {activeBet
                  ? activeBet.autoCashout
                    ? `Auto cash out at ${formatMultiplier(activeBet.autoCashout)}.`
                    : 'Cash out manually before the round crashes.'
                  : 'Enter your stake and place the bet before the countdown ends.'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-surface/80 p-4">
        <h2 className="text-sm font-semibold">This round</h2>
        {state?.bets.length ? (
          <ul className="mt-3 space-y-2">
            {state.bets.map(bet => (
              <li
                key={bet.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold">Bet {bet.slot}</p>
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
            No bets in this round. Choose Bet 1 or Bet 2 and place a bet while the timer is
            counting down.
          </p>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-text">
          Rounds are deterministic {((config?.roundMs ?? 30_000) / 1000).toFixed(0)}-second
          cycles with a {((config?.waitMs ?? 6_000) / 1000).toFixed(0)}-second betting window.
          The crash point is committed server-side, so the browser cannot change the outcome.
        </p>
      </div>
    </div>
  )
}
