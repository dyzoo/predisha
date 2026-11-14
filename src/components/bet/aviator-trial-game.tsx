'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  CircleAlert,
  Loader2,
  Plane,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react'
import type { AviatorTrialView } from '@/lib/bet/aviator-trial'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'

export function AviatorTrialGame({
  initialTrial,
  signedIn,
}: {
  initialTrial: AviatorTrialView
  signedIn: boolean
}) {
  const [trial, setTrial] = useState(initialTrial)
  const [playing, setPlaying] = useState(false)
  const [multiplier, setMultiplier] = useState(
    initialTrial.status === 'GRANTED' ? 1 : initialTrial.multiplier,
  )
  const [progress, setProgress] = useState(initialTrial.status === 'GRANTED' ? 0 : 1)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [])

  async function play() {
    if (playing || !trial.canPlay) return
    setPlaying(true)
    setError(null)
    setMultiplier(1)
    setProgress(0)

    try {
      const response = await fetch('/api/bet/aviator-trial/play', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as {
        trial?: AviatorTrialView
        alreadyPlayed?: boolean
        error?: string
      }

      if (!response.ok || !payload.trial) {
        setError(payload.error ?? 'The trial flight could not start.')
        setPlaying(false)
        return
      }

      const nextTrial = payload.trial
      setTrial(nextTrial)

      if (payload.alreadyPlayed) {
        setMultiplier(nextTrial.multiplier)
        setProgress(1)
        setPlaying(false)
        return
      }

      const startedAt = Date.now()
      const duration = 2800
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.min(1, (Date.now() - startedAt) / duration)
        const eased = 1 - Math.pow(1 - elapsed, 3)
        setProgress(elapsed)
        setMultiplier(1 + (nextTrial.multiplier - 1) * eased)

        if (elapsed >= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current)
          timerRef.current = null
          setPlaying(false)
        }
      }, 50)
    } catch {
      setError('Network error. Please try again.')
      setPlaying(false)
    }
  }

  const won = trial.status !== 'GRANTED'
  const withdrawHref = signedIn ? '/bet/userAccount' : '/bet/easy-signup'
  const planeLeft = 8 + progress * 74
  const planeTop = 68 - Math.sin(progress * Math.PI) * 38

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Guest Aviator trial
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">One flight. One big prize.</h1>
          <p className="mt-1 text-sm text-muted-text">
            Play once with trial credit. No signup needed until you withdraw.
          </p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-wide text-accent">Trial balance</p>
          <p className="font-display text-xl font-bold tabular-nums">
            {formatTzs(won ? trial.prizeMinor : trial.stakeMinor)}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-border bg-surface/80">
        <div className="relative h-72 overflow-hidden bg-[radial-gradient(circle_at_50%_120%,rgba(34,197,94,0.18),transparent_60%)]">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-accent/20" />
          <Plane
            className="absolute h-7 w-7 -rotate-12 text-accent drop-shadow-[0_0_12px_rgba(34,197,94,0.75)] transition-[left,top] duration-75"
            style={{ left: `${planeLeft}%`, top: `${planeTop}%` }}
          />
          <div className="relative flex h-full flex-col items-center justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-text">
              {playing ? 'In flight' : won ? 'Landed at' : 'Ready for takeoff'}
            </p>
            <p className="mt-1 font-display text-6xl font-black tabular-nums text-main-text sm:text-7xl">
              {formatMultiplier(multiplier)}
            </p>
            <p className="mt-2 text-sm text-muted-text">
              Trial stake locked at {formatTzs(trial.stakeMinor)}
            </p>
          </div>
          <span className="absolute right-4 top-4 rounded-full border border-accent/25 bg-background/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {won ? 'Completed' : 'Guaranteed win'}
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_1fr] sm:p-6">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-text">
              Flight plan
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-text">Trial credit</span>
                <span className="font-semibold tabular-nums">{formatTzs(trial.stakeMinor)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-text">Fixed multiplier</span>
                <span className="font-semibold tabular-nums text-accent">
                  {formatMultiplier(trial.multiplier)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <span className="text-muted-text">One-play prize</span>
                <span className="font-bold tabular-nums">{formatTzs(trial.prizeMinor)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {won ? (
              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <Trophy className="h-5 w-5" />
                  <p className="text-sm font-bold">Your trial won!</p>
                </div>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                  {formatTzs(trial.prizeMinor)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-text">
                  {trial.withdrawalStatus === 'PENDING'
                    ? 'Your payout request is already being processed.'
                    : 'Create a quick account, then send the prize to your mobile-money number.'}
                </p>
                <Link
                  href={withdrawHref}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
                >
                  <Wallet className="h-4 w-4" />
                  {trial.withdrawalStatus === 'PENDING' ? 'View payout' : 'Withdraw prize'}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={play}
                disabled={playing || !trial.canPlay}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {playing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plane className="h-4 w-4 -rotate-12" />
                )}
                {playing ? 'Flying to 63.00x...' : `Play trial with ${formatTzs(trial.stakeMinor)}`}
              </button>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-[11px] leading-relaxed text-muted-text">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Trial credit is Aviator-only and cannot be cashed out until the one trial flight is
              complete.
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-4 text-xs text-muted-text sm:flex-row">
        <span>Your trial is separate from the real betting wallet.</span>
        <Link
          href={won ? withdrawHref : '/bet'}
          className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
        >
          {won ? 'Claim my prize' : 'Back to PredishaBet'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
