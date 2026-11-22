'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Copy, ExternalLink, Receipt, Trophy } from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import { VAT_PERCENT } from '@/lib/bet/vat'

export interface AdminWinnerSelectionView {
  fixtureLabel: string
  marketName: string
  selectionLabel: string
  odds: number
  finalScore: { home: number; away: number } | null
}

export interface AdminWinnerListItemView {
  id: string
  code: string
  title: string | null
  userName: string | null
  userEmail: string
  stakeMinor: number
  totalOdds: number
  grossPayoutMinor: number
  vatMinor: number
  netPayoutMinor: number
  ticketCode: string | null
  creditedAt: string | null
  createdAt: string
  selections: AdminWinnerSelectionView[]
}

export function AdminWinnerList({ winners }: { winners: AdminWinnerListItemView[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function copyLink(code: string) {
    const url = new URL(`/bet/winner/${code}`, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCode(code)
    } catch {
      setCopiedCode(null)
    }
  }

  if (winners.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
          <Trophy className="h-5 w-5" />
        </span>
        <p className="mt-4 text-sm font-semibold text-main-text">No winner payouts yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs">
          Assigned winners will appear here with their wallet credit, VAT deduction and share link.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Receipt className="h-4 w-4 text-accent" />
          Recent winner payouts
        </h2>
        <p className="text-[11px] text-muted-text">Showing the latest {winners.length} awards.</p>
      </div>

      {winners.map(winner => (
        <article key={winner.id} className="rounded-2xl border border-amber-300/25 bg-surface/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-main-text">
                <span className="font-mono tracking-[0.18em] text-amber-200">{winner.code}</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  WON
                </span>
                {winner.ticketCode ? (
                  <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-text">
                    {winner.ticketCode}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 truncate text-xs text-muted-text">
                {winner.title ?? 'Winner payout'} | {winner.userName ?? 'Registered user'} (
                {winner.userEmail})
              </p>
              <p className="mt-1 text-[10px] text-muted-text">
                Credited{' '}
                {winner.creditedAt
                  ? formatDateTimeLabel(winner.creditedAt)
                  : formatDateTimeLabel(winner.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink(winner.code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-300/20"
              >
                {copiedCode === winner.code ? (
                  <CircleCheck className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedCode === winner.code ? 'Copied' : 'Copy link'}
              </button>
              <Link
                href={`/bet/winner/${winner.code}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-[10px] font-bold text-main-text hover:border-amber-300/40"
              >
                <ExternalLink className="h-3 w-3" />
                Receipt
              </Link>
              <span className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-amber-200">
                {winner.code}
              </span>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
                {formatTzs(winner.stakeMinor)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-text">Odds</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
                {formatOdds(winner.totalOdds)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-text">Gross</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
                {formatTzs(winner.grossPayoutMinor)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-text">
                VAT {VAT_PERCENT}%
              </dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-red-300">
                -{formatTzs(winner.vatMinor)}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-amber-200/80">Net credit</dt>
              <dd className="mt-0.5 text-xs font-bold tabular-nums text-amber-200">
                {formatTzs(winner.netPayoutMinor)}
              </dd>
            </div>
          </dl>

          <details className="mt-3 rounded-xl border border-border bg-background/40 p-2.5">
            <summary className="cursor-pointer text-[11px] font-semibold text-muted-text">
              {winner.selections.length} winning selections
            </summary>
            <ul className="mt-2 space-y-1.5">
              {winner.selections.map((selection, index) => (
                <li
                  key={`${winner.id}:${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate text-main-text">
                    {selection.fixtureLabel} | {selection.marketName} | {selection.selectionLabel}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {selection.finalScore ? (
                      <span className="font-semibold tabular-nums text-amber-200">
                        {selection.finalScore.home}-{selection.finalScore.away}
                      </span>
                    ) : null}
                    <span className="font-semibold tabular-nums text-muted-text">
                      {formatOdds(selection.odds)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
    </section>
  )
}
