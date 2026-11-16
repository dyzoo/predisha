import Link from 'next/link'
import {
  BadgeCheck,
  CalendarDays,
  CircleCheck,
  ReceiptText,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import type { PublicWinnerSlipView } from '@/lib/bet/winners'
import { VAT_PERCENT } from '@/lib/bet/vat'
import { WinnerConfetti } from './winner-confetti'

export function WinnerReceipt({ winner }: { winner: PublicWinnerSlipView }) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="relative overflow-hidden rounded-3xl border-2 border-amber-300/60 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(240,213,46,0.2),transparent_58%),linear-gradient(180deg,#252C36_0%,#141A21_100%)] p-5 shadow-[0_30px_80px_-50px_rgba(240,213,46,0.65)] sm:p-7">
        <WinnerConfetti />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/50 bg-amber-300/15 text-amber-300 shadow-[0_0_40px_-10px_rgba(240,213,46,0.7)]">
                <Trophy className="h-7 w-7" />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Winner slip
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-main-text sm:text-3xl">
                  {winner.title ?? 'Winning bet slip'}
                </h1>
                <p className="mt-1 text-xs text-muted-text">
                  Awarded to {winner.recipientName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                <BadgeCheck className="h-3.5 w-3.5" />
                Won
              </span>
              <p className="mt-2 font-mono text-sm font-bold tracking-[0.24em] text-amber-200">
                {winner.code}
              </p>
              {winner.ticketCode ? (
                <p className="mt-1 text-[10px] text-muted-text">
                  Ticket <span className="font-mono text-main-text">{winner.ticketCode}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
              Net payout credited
            </p>
            <p className="mt-1 font-display text-4xl font-black tracking-tight tabular-nums text-amber-200 sm:text-5xl">
              {formatTzs(winner.netPayoutMinor)}
            </p>
            <p className="mt-2 text-[11px] text-amber-100/70">
              Gross {formatTzs(winner.grossPayoutMinor)} minus {VAT_PERCENT}% VAT (
              {formatTzs(winner.vatMinor)})
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-main-text">
                {formatTzs(winner.stakeMinor)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-200">
                {formatOdds(winner.totalOdds)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Selections</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-main-text">
                {winner.selections.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Credited</p>
              <p className="mt-0.5 text-[11px] font-semibold text-main-text">
                {winner.creditedAt
                  ? formatDateTimeLabel(winner.creditedAt)
                  : formatDateTimeLabel(winner.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
                <ReceiptText className="h-4 w-4 text-amber-300" />
                Winning selections
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-text">
                <CalendarDays className="h-3.5 w-3.5" />
                Settled
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {winner.selections.map((selection, index) => (
                <li
                  key={`${selection.fixtureId}:${index}`}
                  className="rounded-xl border border-amber-300/20 bg-surface/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-main-text">
                        {selection.fixtureLabel}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-text">
                        {selection.competition}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span className="font-semibold text-amber-200">{selection.marketName}</span>
                        <span className="text-muted-text">{selection.selectionLabel}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {selection.finalScore ? (
                        <>
                          <p className="font-mono text-lg font-black tabular-nums text-amber-200">
                            {selection.finalScore.home} - {selection.finalScore.away}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-text">
                            Final
                          </p>
                        </>
                      ) : null}
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-200">
                        <CircleCheck className="h-3 w-3" />
                        {formatOdds(selection.odds)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-main-text">Already in the wallet</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-text">
                    {formatTzs(winner.netPayoutMinor)} was credited after the {VAT_PERCENT}% VAT
                    deduction. Withdraw it to mobile money from the wallet page.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/bet/account"
                  className="rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Open wallet
                </Link>
                <Link
                  href="/bet/withdraw"
                  className="rounded-xl border border-border bg-background/40 px-4 py-2.5 text-xs font-semibold text-main-text transition-colors hover:border-accent/40"
                >
                  Withdraw
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-text">
            <span>Winner payout recorded against the betting wallet.</span>
            <Link href="/bet/bets" className="font-semibold text-amber-200 hover:underline">
              View in My Bets
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
