'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Banknote,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  FlaskConical,
  Loader2,
  Ticket,
  X,
} from 'lucide-react'
import {
  formatDateTimeLabel,
  formatOdds,
  formatTzs,
  statusLabel,
} from '@/lib/bet/format'
import type { BetTicketView, TicketResult } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

function ResultBadge({ result }: { result: TicketResult }) {
  if (result === 'WON') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
        <Check className="h-3 w-3" />
        Won
      </span>
    )
  }
  if (result === 'LOST') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
        <X className="h-3 w-3" />
        Lost
      </span>
    )
  }
  if (result === 'VOID') {
    return (
      <span className="rounded-full bg-elevated-surface px-2 py-0.5 text-[10px] font-semibold text-muted-text">
        Void
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-elevated-surface px-2 py-0.5 text-[10px] font-semibold text-muted-text">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  )
}

function statusClasses(status: BetTicketView['status']): string {
  switch (status) {
    case 'WON':
      return 'bg-accent/15 text-accent'
    case 'LOST':
      return 'bg-red-400/15 text-red-300'
    case 'CASHED_OUT':
      return 'bg-sky-400/15 text-sky-300'
    case 'VOID':
      return 'bg-elevated-surface text-muted-text'
    default:
      return 'bg-accent/10 text-accent'
  }
}

export function TicketsList({ tickets }: { tickets: BetTicketView[] }) {
  const router = useRouter()
  const { refreshWallet } = useBetSlip()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (tickets.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Ticket className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">No tickets yet</h2>
        <p className="mt-1 text-sm text-muted-text">
          Build a slip from the sportsbook and your tickets will appear here.
        </p>
        <Link
          href="/bet/sports"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse fixtures
        </Link>
      </div>
    )
  }

  async function runAction(ticket: BetTicketView, action: 'cashout' | 'settle-demo') {
    setBusyId(ticket.id)
    setErrorId(null)
    setErrorMessage(null)
    setSuccessId(null)
    setSuccessMessage(null)
    try {
      const response = await fetch(`/api/bet/bets/${ticket.id}/${action}`, { method: 'POST' })
      const payload = (await response.json().catch(() => ({}))) as {
        ticket?: BetTicketView
        error?: string
      }
      if (!response.ok) {
        setErrorId(ticket.id)
        setErrorMessage(payload.error ?? 'The ticket could not be updated.')
        return
      }
      setSuccessId(ticket.id)
      setSuccessMessage(
        action === 'cashout'
          ? `Ticket ${ticket.code} cashed out for ${formatTzs(
              payload.ticket?.payoutMinor ?? 0,
            )}.`
          : `Demo result applied. Ticket ${ticket.code} is ${(
              payload.ticket?.status ?? 'updated'
            ).toLowerCase()}.`,
      )
      await refreshWallet()
      router.refresh()
    } catch {
      setErrorId(ticket.id)
      setErrorMessage('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {tickets.map(ticket => {
        const busy = busyId === ticket.id
        const canCashout = ticket.status === 'OPEN' && ticket.cashoutMinor !== null
        return (
          <article key={ticket.id} className="rounded-2xl border border-border bg-surface/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-background/60 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-accent">
                    {ticket.code}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(ticket.status)}`}
                  >
                    {statusLabel(ticket.status)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-text">
                  Placed {formatDateTimeLabel(ticket.placedAt)} · {ticket.selectionCount} selection
                  {ticket.selectionCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                <p className="text-sm font-bold tabular-nums">{formatTzs(ticket.stakeMinor)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-background/40 p-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Odds</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatOdds(ticket.totalOdds)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Potential</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatTzs(ticket.potentialReturnMinor)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-text">
                  {ticket.status === 'OPEN' ? 'Cash out' : 'Payout'}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-accent">
                  {formatTzs(
                    ticket.status === 'OPEN'
                      ? (ticket.cashoutMinor ?? 0)
                      : ticket.payoutMinor,
                  )}
                </p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-border">
              {ticket.selections.map(selection => (
                <li key={`${selection.fixtureId}:${selection.marketId}`} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{selection.fixtureLabel}</p>
                      <p className="mt-0.5 text-[11px] text-muted-text">
                        {selection.marketName} · {selection.selectionLabel} ·{' '}
                        {formatOdds(selection.odds)}
                      </p>
                      {selection.finalScore ? (
                        <p className="mt-0.5 text-[10px] text-muted-text">
                          Final {selection.finalScore.home}–{selection.finalScore.away}
                          {selection.demoResult ? ' · demo result' : ''}
                        </p>
                      ) : null}
                    </div>
                    <ResultBadge result={selection.result} />
                  </div>
                </li>
              ))}
            </ul>

            {errorId === ticket.id && errorMessage ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            ) : null}
            {successId === ticket.id && successMessage ? (
              <div
                role="status"
                className="mt-3 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent"
              >
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            ) : null}

            {canCashout || ticket.demoEligible ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {canCashout ? (
                  <button
                    type="button"
                    onClick={() => runAction(ticket, 'cashout')}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-background disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    Cash out {formatTzs(ticket.cashoutMinor ?? 0)}
                  </button>
                ) : null}
                {ticket.demoEligible ? (
                  <button
                    type="button"
                    onClick={() => runAction(ticket, 'settle-demo')}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-text hover:border-accent/40 hover:text-accent disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="h-4 w-4" />
                    )}
                    Simulate demo result
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
