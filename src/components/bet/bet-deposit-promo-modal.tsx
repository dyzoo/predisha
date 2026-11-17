'use client'

import Link from 'next/link'
import { ArrowRight, Gamepad2, Sparkles, Wallet, X } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { MIN_WALLET_BALANCE_MINOR } from '@/lib/bet/types'

export function BetDepositPromoModal({
  open,
  balanceMinor,
  onClose,
}: {
  open: boolean
  balanceMinor: number
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-background/85 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bet-deposit-promo-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-accent/30 bg-surface shadow-2xl shadow-black/50"
      >
        <div className="relative overflow-hidden border-b border-accent/20 bg-gradient-to-br from-accent/25 via-surface to-surface p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss deposit promotion"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/60 text-muted-text transition-colors hover:text-main-text"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-background">
              <Gamepad2 className="h-6 w-6" />
            </span>
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Games are ready
              </p>
              <h2 id="bet-deposit-promo-title" className="mt-1 font-display text-2xl font-semibold">
                Top up to play
              </h2>
            </div>
          </div>

          <p className="relative mt-4 text-sm leading-relaxed text-muted-text">
            A minimum wallet balance of{' '}
            <span className="font-semibold text-main-text">{formatTzs(MIN_WALLET_BALANCE_MINOR)}</span>{' '}
            unlocks Aviator, Mines, Dice, Roulette and Slots.
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                Your balance
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">
                {formatTzs(balanceMinor)}
              </p>
            </div>
            <div className="rounded-2xl border border-accent/35 bg-accent/10 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                Minimum to play
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-accent">
                {formatTzs(MIN_WALLET_BALANCE_MINOR)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-background/50 px-3 py-2 text-xs text-muted-text">
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-accent" />
              Shared slips are still paid separately
            </span>
          </div>

          <Link
            href="/bet/deposit"
            onClick={onClose}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90"
          >
            Deposit now
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-main-text"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
