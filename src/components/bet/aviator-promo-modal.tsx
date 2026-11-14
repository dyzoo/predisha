'use client'

import Link from 'next/link'
import { ArrowRight, Gift, Plane, Sparkles, X } from 'lucide-react'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'
import type { AviatorTrialView } from '@/lib/bet/aviator-trial'

export function AviatorPromoModal({
  trial,
  onClose,
}: {
  trial: AviatorTrialView
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-background/85 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviator-promo-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-accent/30 bg-surface shadow-2xl shadow-black/50"
      >
        <div className="relative overflow-hidden border-b border-accent/20 bg-gradient-to-br from-accent/25 via-surface to-surface p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss Aviator trial offer"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/60 text-muted-text transition-colors hover:text-main-text"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-background">
              <Plane className="h-6 w-6 -rotate-12" />
            </span>
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Aviator trial unlocked
              </p>
              <h2 id="aviator-promo-title" className="mt-1 font-display text-2xl font-semibold">
                Your free flight is ready
              </h2>
            </div>
          </div>

          <p className="relative mt-4 text-sm leading-relaxed text-muted-text">
            Your shared slip is paid. We loaded an Aviator-only trial wallet with{' '}
            <span className="font-semibold text-main-text">{formatTzs(trial.stakeMinor)}</span>. One
            flight, no signup needed.
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                Trial credit
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">
                {formatTzs(trial.stakeMinor)}
              </p>
            </div>
            <div className="rounded-2xl border border-accent/35 bg-accent/10 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                One-play prize
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-accent">
                {formatTzs(trial.prizeMinor)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-background/50 px-3 py-2 text-xs text-muted-text">
            <span className="inline-flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-accent" />
              Fixed trial return
            </span>
            <span className="font-bold tabular-nums text-main-text">
              {formatMultiplier(trial.multiplier)}
            </span>
          </div>

          <Link
            href="/bet/aviator-trial"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90"
          >
            Play free Aviator trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-main-text"
          >
            Not now
          </button>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-text">
            Signup is only required when you withdraw the trial prize.
          </p>
        </div>
      </div>
    </div>
  )
}
