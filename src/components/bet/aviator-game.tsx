'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import type {
  AviatorBetView,
  AviatorPlayerView,
  AviatorRoundView,
  BetWalletView,
} from '@/lib/bet/types'
import { MIN_STAKE_MINOR } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

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

export function AviatorGame() {
  const { refreshWallet } = useBetSlip()
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

  const paintAviator = useCallback((data: AviatorState) => {
    const phase: Phase = data.round.phase.toLowerCase() as Phase
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

  const cashout = async (betId: string) => {
    setBusySlot(1)
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
        `Cashed out Bet ${payload.bet?.slot ?? 1} at ${formatMultiplier(payload.bet?.cashedOutAt ?? 1)} for ${formatTzs(payload.bet?.payoutMinor ?? 0)}.`,
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
    const phaseNow = state.round.phase.toLowerCase() as Phase
    const mine = state.bets.find(bet => bet.slot === slot) ?? null

    if (phaseNow === 'wait' && !mine) {
      await placeBet(slot)
      return
    }

    if (phaseNow === 'fly' && mine && mine.status === 'ACTIVE') {
      await cashout(mine.id)
    }
  }

  const phase = (state?.round.phase.toLowerCase() ?? 'wait') as Phase
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
          let label = 'Bet'
          let disabled = false
          let buttonClass = ''

          if (phase === 'wait' && mine) {
            label = 'Waiting'
            disabled = true
            buttonClass = 'wait'
          } else if (phase === 'fly' && mine && mine.status === 'ACTIVE') {
            label = `Cash out ${activeMultiplier.toFixed(2)}x`
            buttonClass = 'cash'
          } else if (mine && mine.status === 'CASHED_OUT') {
            label = `Cashed ${(mine.cashedOutAt ?? 0).toFixed(2)}x`
            disabled = true
          } else if (phase !== 'wait') {
            label = phase === 'fly' ? 'Next round' : 'Bet'
            disabled = true
          }

          const note =
            mine && mine.status === 'CASHED_OUT'
              ? `Won ${formatTzs(Math.round(mine.stakeMinor * (mine.cashedOutAt ?? 0)))}`
              : ''

          return (
            <article className="av-panel" data-slot={slot} key={slot}>
              <div className="av-panel-h">Bet {slot}</div>
              <input
                className="input"
                id={`avStake${slot}`}
                inputMode="numeric"
                type="number"
                min={MIN_STAKE_MINOR}
                step={500}
                value={panels[slot].stakeMinor}
                onChange={event => setPanels(current => ({ ...current, [slot]: { ...current[slot], stakeMinor: Number(event.target.value) } }))}
              />
              <input
                className="input"
                id={`avAuto${slot}`}
                inputMode="decimal"
                type="number"
                min={1.1}
                max={state?.config.maxCrash ?? 100}
                step={0.1}
                value={panels[slot].autoCashout}
                placeholder="Auto cash out e.g. 2.00"
                onChange={event => setPanels(current => ({ ...current, [slot]: { ...current[slot], autoCashout: event.target.value } }))}
              />
              <button
                className={`wide gold ${buttonClass} ${busySlot === slot ? 'is-busy' : ''}`}
                type="button"
                id={`avGo${slot}`}
                disabled={disabled || busySlot === slot}
                onClick={() => void handleBetClick(slot)}
              >
                {busySlot === slot ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
              </button>
              <p className="hint" id={`avSlotMsg${slot}`}>
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
