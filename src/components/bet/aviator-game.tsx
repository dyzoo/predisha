'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import type {
  AviatorBetView,
  AviatorPlayerView,
  AviatorRoundView,
  BetWalletView,
} from '@/lib/bet/types'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { isBelowGameWalletMinimum, WalletMinimumNotice } from './wallet-minimum-gate'

interface AviatorState {
  round: AviatorRoundView
  bets: AviatorBetView[]
  players: AviatorPlayerView[]
  history: Array<{ roundId: string; crashAt: number }>
  wallet: BetWalletView
  config: import('@/lib/bet/aviator-config').AviatorConfig
}

interface BetPanelState {
  stakeMinor: number
  autoCashout: string
}

type Slot = 1 | 2
type Phase = 'wait' | 'fly' | 'crash'
const AVIATOR_SLOTS: Slot[] = [1, 2]
const AVIATOR_QUICK_STAKES = [1_000, 5_000, 10_000, 50_000]
const AVIATOR_AUTO_CHIPS = [1.5, 2, 3, 5]

function toPhase(phase: AviatorRoundView['phase']): Phase {
  if (phase === 'WAITING') return 'wait'
  if (phase === 'FLYING') return 'fly'
  return 'crash'
}

export function AviatorGame() {
  const { wallet, refreshWallet } = useBetSlip()
  const skyRef = useRef<HTMLDivElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const planeRef = useRef<HTMLDivElement | null>(null)
  const histRef = useRef<HTMLDivElement | null>(null)
  const playersRef = useRef<HTMLDivElement | null>(null)
  const readoutMultRef = useRef<HTMLSpanElement | null>(null)
  const readoutMsgRef = useRef<HTMLParagraphElement | null>(null)

  const [state, setState] = useState<AviatorState | null>(null)
  const [panels, setPanels] = useState<Record<number, BetPanelState>>({
    1: { stakeMinor: 1_000, autoCashout: '' },
    2: { stakeMinor: 1_000, autoCashout: '' },
  })
  const [busySlot, setBusySlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const walletBlocked = isBelowGameWalletMinimum(
    state?.wallet.balanceMinor ?? wallet?.balanceMinor,
  )

  const paintAviator = useCallback((data: AviatorState) => {
    const phase = toPhase(data.round.phase)
    const multiplier = data.round.multiplier
    const crash = data.round.crashAt
    const waitLeft = data.round.waitRemainingMs
    const players = data.players ?? []
    const betCount = players.filter(player => player.status === 'ACTIVE').length
    const history = data.history.map(item => item.crashAt)

    const sky = skyRef.current
    if (sky) {
      sky.classList.remove('is-wait', 'is-fly', 'is-crash')
      sky.classList.add(phase === 'wait' ? 'is-wait' : phase === 'fly' ? 'is-fly' : 'is-crash')
    }

    const multEl = readoutMultRef.current
    const msgEl = readoutMsgRef.current
    if (multEl) {
      multEl.textContent = (phase === 'crash' ? crash : multiplier).toFixed(2) + 'x'
      multEl.classList.toggle('crash', phase === 'crash')
    }
    if (msgEl) {
      if (phase === 'wait') {
        msgEl.textContent = `Betting Aviator starts in ${(waitLeft / 1000).toFixed(1)}s`
      } else if (phase === 'fly') {
        msgEl.textContent = `${betCount} bets in the air`
      } else {
        msgEl.textContent = `Flew away at ${crash.toFixed(2)}x`
      }
    }

    const pct = Math.min(0.88, Math.log(Math.max(1, multiplier)) / Math.log(18))
    const plane = planeRef.current
    if (plane) {
      plane.style.left = `${6 + pct * 80}%`
      plane.style.bottom = `${10 + pct * 64}%`
      plane.style.opacity = phase === 'crash' ? '0' : '1'
    }

    const path = pathRef.current
    if (path) {
      const x = 8 + pct * 84
      const y = 56 - pct * 48
      path.setAttribute('d', `M0 58 Q ${x * 0.45} 58 ${x} ${y}`)
      path.setAttribute('stroke', phase === 'crash' ? '#ef4444' : '#d7a441')
    }

    const hist = histRef.current
    if (hist) {
      hist.innerHTML = history
        .map(n => `<span class="${n < 2 ? 'low' : n < 10 ? 'mid' : 'high'}">${n.toFixed(2)}x</span>`)
        .join('')
    }

    const playersEl = playersRef.current
    if (playersEl) {
      playersEl.innerHTML = players
        .map(player => {
          const mine = player.mine ? 'mine' : ''
          return `<div class="av-row ${mine}"><span>${player.name}</span><span>${formatTzs(player.stakeMinor)}</span><b>${player.status === 'CASHED_OUT' && player.cashedOutAt ? player.cashedOutAt.toFixed(2) + 'x' : '—'}</b></div>`
        })
        .join('')
      if (players.length === 0) playersEl.innerHTML = '<p class="hint">Waiting for bets</p>'
    }
  }, [])

  useEffect(() => {
    if (state) paintAviator(state)
  }, [paintAviator, state])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const response = await fetch('/api/bet/games/aviator/state', { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as {
        state?: AviatorState
        error?: string
        code?: string
      }

      if (!cancelled) {
        if (response.ok && payload.state) {
          setState(payload.state)
          setError(null)
          setErrorCode(null)
        } else if (response.status !== 401) {
          setError(payload.error ?? 'Could not load the Aviator round.')
          setErrorCode(payload.code ?? null)
        }
      }

      timer = setTimeout(() => {
        void tick()
      }, 120)
    }

    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [paintAviator])

  useEffect(() => {
    if (!success) return
    const timeout = setTimeout(() => setSuccess(null), 6_000)
    return () => clearTimeout(timeout)
  }, [success])

  const loadState = useCallback(async () => {
    const response = await fetch('/api/bet/games/aviator/state', { cache: 'no-store' })
    const payload = (await response.json().catch(() => ({}))) as {
      state?: AviatorState
      error?: string
      code?: string
    }
    if (response.ok && payload.state) {
      setState(payload.state)
      setError(null)
      setErrorCode(null)
    } else {
      setError(payload.error ?? 'Could not load the Aviator round.')
      setErrorCode(payload.code ?? null)
    }
  }, [])

  const placeBet = async (slot: Slot) => {
    const panel = panels[slot]
    setBusySlot(slot)
    setError(null)
    setErrorCode(null)
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
        code?: string
      }

      if (!response.ok) {
        setError(payload.error ?? 'Could not place the Aviator bet.')
        setErrorCode(payload.code ?? null)
        return
      }

      setSuccess(
        `Bet ${payload.bet?.slot ?? slot} placed for ${formatTzs(payload.bet?.stakeMinor ?? panel.stakeMinor)}.`,
      )
      await loadState()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusySlot(null)
    }
  }

  const cashout = async (betId: string, slot: Slot) => {
    setBusySlot(slot)
    setError(null)
    setErrorCode(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/bet/games/aviator/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        bet?: AviatorBetView
        error?: string
        code?: string
      }

      if (!response.ok) {
        setError(payload.error ?? 'Cash out failed.')
        setErrorCode(payload.code ?? null)
        return
      }

      setSuccess(
        `Cashed out Bet ${payload.bet?.slot ?? slot} at ${formatMultiplier(payload.bet?.cashedOutAt ?? 1)} for ${formatTzs(payload.bet?.payoutMinor ?? 0)}.`,
      )
      await loadState()
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusySlot(null)
    }
  }

  const handleBetClick = async (slot: Slot) => {
    if (!state) return
    const phaseNow = toPhase(state.round.phase)
    const mine = state.bets.find(bet => bet.slot === slot) ?? null

    if (phaseNow === 'wait' && !mine) {
      await placeBet(slot)
      return
    }

    if (phaseNow === 'fly' && mine && mine.status === 'ACTIVE') {
      await cashout(mine.id, slot)
    }
  }

  const phase = state ? toPhase(state.round.phase) : 'wait'
  const activeMultiplier = state?.round.multiplier ?? 1

  return (
    <section className="av-page">
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          <span>{error}</span>
          {errorCode === 'INSUFFICIENT_FUNDS' ? (
            <Link
              href="/bet/deposit"
              className="ml-auto inline-flex shrink-0 items-center rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-background"
            >
              Deposit
            </Link>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
          <span>{success}</span>
        </div>
      ) : null}

      <WalletMinimumNotice
        balanceMinor={state?.wallet.balanceMinor ?? wallet?.balanceMinor}
        className="mb-2"
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/70 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-text">
          <Wallet className="h-4 w-4 text-accent" />
          Aviator bets are placed here, using your main wallet.
        </span>
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular-nums text-main-text">
            {state ? formatTzs(state.wallet.balanceMinor) : '…'}
          </span>
          <Link
            href="/bet/deposit"
            className="rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-background"
          >
            Deposit
          </Link>
        </span>
      </div>

      <div className="av-hist" id="avHist" ref={histRef} />

      <div className="av-sky" id="avSky" ref={skyRef}>
        <div className="av-clouds" />
        <svg className="av-curve" viewBox="0 0 100 60" preserveAspectRatio="none">
          <path
            id="avPath"
            ref={pathRef}
            d="M0 58 Q 20 58 40 40"
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.4"
          />
        </svg>
        <div className="av-plane" id="avPlane" ref={planeRef}>
          ✈
        </div>
        <div className="av-readout">
          <div className="av-live">
            <span className="live-dot">LIVE</span> AVIATOR
          </div>
          <b id="aviatorMult" ref={readoutMultRef}>
            1.00x
          </b>
          <p id="aviatorMsg" ref={readoutMsgRef}>
            Betting open
          </p>
        </div>
      </div>

      <div className="av-bets">
        {AVIATOR_SLOTS.map(slot => {
          const mine = state?.bets.find(bet => bet.slot === slot) ?? null
          const active = mine?.status === 'ACTIVE'
          const cashed = mine?.status === 'CASHED_OUT'
          const lost = mine?.status === 'LOST'

          const statusText = !state
            ? 'Connecting'
            : active
              ? phase === 'fly'
                ? 'Flying'
                : 'Placed'
              : cashed
                ? 'Cashed'
                : lost
                  ? 'Lost'
                  : phase === 'wait'
                    ? 'Open'
                    : phase === 'fly'
                      ? 'Flying'
                      : 'Crashed'

          const statusTone = !state
            ? 'is-muted'
            : active
              ? phase === 'fly'
                ? 'is-live'
                : 'is-open'
              : cashed
                ? 'is-win'
                : lost
                  ? 'is-lost'
                  : phase === 'wait'
                    ? 'is-open'
                    : phase === 'fly'
                      ? 'is-live'
                      : 'is-crash'

          const title = !state
            ? 'Getting ready'
            : active
              ? phase === 'fly'
                ? 'In the air'
                : 'You are in'
              : cashed
                ? 'Nice cash out'
                : lost
                  ? 'Round ended'
                  : phase === 'wait'
                    ? 'Ready to fly'
                    : 'Next round'

          let ctaLabel = 'Place bet'
          let ctaClass = ''
          let disabled = !state

          if (!state) {
            ctaLabel = 'Connecting…'
            ctaClass = 'is-wait'
          } else if (phase === 'wait' && mine) {
            ctaLabel = 'Bet placed'
            disabled = true
            ctaClass = 'is-wait'
          } else if (phase === 'fly' && active) {
            ctaLabel = `Cash out ${activeMultiplier.toFixed(2)}x`
            ctaClass = 'is-cash'
          } else if (cashed) {
            ctaLabel = `Cashed at ${(mine?.cashedOutAt ?? 0).toFixed(2)}x`
            disabled = true
            ctaClass = 'is-done'
          } else if (lost) {
            ctaLabel = 'Round lost'
            disabled = true
            ctaClass = 'is-lost'
          } else if (phase !== 'wait') {
            ctaLabel = phase === 'fly' ? 'Next round opens soon' : 'Next round'
            disabled = true
            ctaClass = 'is-wait'
          } else if (walletBlocked) {
            ctaLabel = 'Deposit to play'
            disabled = true
            ctaClass = 'is-wait'
          }

          let note = 'Place your bet before takeoff.'
          let noteClass = ''

          if (!state) {
            note = 'Loading the round…'
          } else if (phase === 'fly' && active) {
            note = `Cash out value ${formatTzs(Math.round((mine?.stakeMinor ?? 0) * activeMultiplier))}`
            noteClass = 'is-live'
          } else if (cashed) {
            note = `Won ${formatTzs(mine?.payoutMinor ?? 0)}`
            noteClass = 'is-win'
          } else if (lost) {
            note = 'Better luck next round.'
            noteClass = 'is-lost'
          } else if (phase === 'wait' && active) {
            note = mine?.autoCashout
              ? `Auto cash out at ${mine.autoCashout.toFixed(2)}x`
              : 'You are in. Good luck!'
          } else if (phase === 'fly') {
            note = 'Cash out is closed for this round.'
          } else if (phase === 'crash') {
            note = 'Waiting for the next round.'
          } else if (walletBlocked) {
            note = 'Deposit to reach the 5,000 TZS wallet minimum.'
            noteClass = 'is-lost'
          }

          return (
            <article className="av-panel" data-slot={slot} key={slot}>
              <div className="av-panel-head">
                <div>
                  <div className="av-panel-kicker">Bet {slot}</div>
                  <h3 className="av-panel-title">{title}</h3>
                </div>
                <span className={`av-pill ${statusTone}`}>{statusText}</span>
              </div>

              <label className="av-field" htmlFor={`avStake${slot}`}>
                <span className="av-field-label">Bet amount</span>
                <span className="av-stake">
                  <span className="av-currency">TZS</span>
                  <input
                    className="av-stake-input"
                    id={`avStake${slot}`}
                    inputMode="numeric"
                    type="number"
                    min={MIN_STAKE_MINOR}
                    step={500}
                    value={panels[slot].stakeMinor}
                    onChange={event => setPanels(current => ({ ...current, [slot]: { ...current[slot], stakeMinor: Number(event.target.value) } }))}
                  />
                </span>
              </label>

              <div className="av-chips" aria-label={`Quick stake amounts for Bet ${slot}`}>
                {AVIATOR_QUICK_STAKES.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={panels[slot].stakeMinor === amount}
                    onClick={() =>
                      setPanels(current => ({
                        ...current,
                        [slot]: { ...current[slot], stakeMinor: amount },
                      }))
                    }
                    className={`av-chip ${panels[slot].stakeMinor === amount ? 'is-active' : ''}`}
                  >
                    {formatTzs(amount).replace('TZS ', '')}
                  </button>
                ))}
              </div>

              <label className="av-field" htmlFor={`avAuto${slot}`}>
                <span className="av-field-label">
                  Auto cash out
                  <span className="av-optional">Optional</span>
                </span>
                <span className="av-auto">
                  <input
                    className="av-auto-input"
                    id={`avAuto${slot}`}
                    inputMode="decimal"
                    type="number"
                    min={1.1}
                    max={state?.config.maxCrash ?? 100}
                    step={0.1}
                    value={panels[slot].autoCashout}
                    placeholder="Set a target"
                    onChange={event => setPanels(current => ({ ...current, [slot]: { ...current[slot], autoCashout: event.target.value } }))}
                  />
                  <span className="av-auto-x">x</span>
                </span>
              </label>

              <div className="av-chips av-chips-auto" aria-label={`Quick auto cash out values for Bet ${slot}`}>
                {AVIATOR_AUTO_CHIPS.map(target => {
                  const selected = Number(panels[slot].autoCashout) === target
                  return (
                    <button
                      key={target}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setPanels(current => ({
                          ...current,
                          [slot]: {
                            ...current[slot],
                            autoCashout: selected ? '' : target.toFixed(2),
                          },
                        }))
                      }
                      className={`av-chip ${selected ? 'is-active' : ''}`}
                    >
                      {target.toFixed(2)}x
                    </button>
                  )
                })}
              </div>

              <button
                className={`av-cta ${ctaClass} ${busySlot === slot ? 'is-busy' : ''}`}
                type="button"
                id={`avGo${slot}`}
                disabled={disabled || busySlot === slot}
                onClick={() => void handleBetClick(slot)}
              >
                {busySlot === slot ? <Loader2 className="h-5 w-5 animate-spin" /> : ctaLabel}
              </button>
              <p className={`av-note ${noteClass}`} id={`avSlotMsg${slot}`}>
                {note}
              </p>
            </article>
          )
        })}
      </div>

      <div className="av-players" id="avPlayers" ref={playersRef} />
    </section>
  )
}
