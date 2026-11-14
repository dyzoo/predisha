'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Banknote,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  FlaskConical,
  History,
  Loader2,
  Radio,
  Ticket,
  Trophy,
  X,
} from 'lucide-react'
import {
  formatDateTimeLabel,
  formatOdds,
  formatTzs,
  statusLabel,
} from '@/lib/bet/format'
import type {
  BetEvent,
  BetTicketView,
  TicketResult,
  TicketSelection,
} from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'

type Tab = 'OPEN' | 'HISTORY'
type EventMap = Record<string, BetEvent>

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

function isLiveTicket(ticket: BetTicketView, events: EventMap): boolean {
  if (ticket.status !== 'OPEN') return false
  return ticket.selections.some(selection => events[selection.fixtureId]?.live)
}

function selectionScore(selection: TicketSelection, event?: BetEvent) {
  return event?.score ?? selection.finalScore
}

function liveMinute(selection: TicketSelection, event?: BetEvent): string | null {
  if (!event?.live) return null
  const elapsed = Date.now() - new Date(selection.kickoffIso).getTime()
  const minute = Math.min(90, Math.max(1, Math.floor(elapsed / 60_000)))
  return `${minute}'`
}

function TicketRef({ code }: { code: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-text">Ref</p>
      <p className="font-mono text-xs font-semibold tracking-wider text-accent">{code}</p>
    </div>
  )
}

function WaitingTicketBody({ ticket }: { ticket: BetTicketView }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">Waiting</p>
          <p className="mt-1 text-[11px] text-muted-text">
            {ticket.selectionCount} selection{ticket.selectionCount === 1 ? '' : 's'} · placed{' '}
            {formatDateTimeLabel(ticket.placedAt)}
          </p>
        </div>
        <TicketRef code={ticket.code} />
      </div>

      <ul className="mt-4 space-y-2">
        {ticket.selections.map(selection => (
          <li
            key={`${selection.fixtureId}:${selection.marketId}`}
            className="rounded-xl border border-border bg-background/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{selection.fixtureLabel}</p>
                <p className="mt-0.5 text-[10px] text-muted-text">{selection.competition}</p>
              </div>
              <p className="shrink-0 text-[10px] font-medium text-muted-text">
                {formatDateTimeLabel(selection.kickoffIso)}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="truncate text-[11px] text-muted-text">
                {selection.marketName} · {selection.selectionLabel}
              </p>
              <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-accent">
                {formatOdds(selection.odds)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums">{formatTzs(ticket.stakeMinor)}</p>
        </div>
        <div className="rounded-xl border border-accent/25 bg-accent/10 p-3">
          <p className="text-[10px] uppercase tracking-wide text-accent/80">Possible win</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-accent">
            {formatTzs(ticket.potentialReturnMinor)}
          </p>
        </div>
      </div>
    </>
  )
}

function LiveTicketBody({
  ticket,
  events,
}: {
  ticket: BetTicketView
  events: EventMap
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
          <span className="text-[11px] text-muted-text">
            {ticket.selectionCount} selection{ticket.selectionCount === 1 ? '' : 's'}
          </span>
        </div>
        <TicketRef code={ticket.code} />
      </div>

      <ul className="mt-4 space-y-2">
        {ticket.selections.map(selection => {
          const event = events[selection.fixtureId]
          const score = selectionScore(selection, event)
          const minute = liveMinute(selection, event)
          return (
            <li
              key={`${selection.fixtureId}:${selection.marketId}`}
              className="rounded-xl border border-red-400/20 bg-background/50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{selection.fixtureLabel}</p>
                  <p className="mt-0.5 text-[10px] text-muted-text">{selection.competition}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold leading-none tabular-nums">
                    {score ? `${score.home} - ${score.away}` : '—'}
                  </p>
                  {minute ? (
                    <p className="mt-1 text-[10px] font-semibold text-red-300">{minute}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="truncate text-[11px] text-muted-text">
                  {selection.marketName} · {selection.selectionLabel}
                </p>
                <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-accent">
                  {formatOdds(selection.odds)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums">{formatTzs(ticket.stakeMinor)}</p>
        </div>
        <div className="rounded-xl border border-red-400/20 bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-text">Potential</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-accent">
            {formatTzs(ticket.potentialReturnMinor)}
          </p>
        </div>
      </div>
    </>
  )
}

function WonTicketBody({ ticket }: { ticket: BetTicketView }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/15 text-amber-300">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              You won
            </p>
            <p className="mt-0.5 text-[11px] text-muted-text">
              Settled {ticket.settledAt ? formatDateTimeLabel(ticket.settledAt) : '—'}
            </p>
          </div>
        </div>
        <TicketRef code={ticket.code} />
      </div>

      <ul className="mt-4 space-y-2">
        {ticket.selections.map(selection => {
          const score = selection.finalScore
          return (
            <li
              key={`${selection.fixtureId}:${selection.marketId}`}
              className="rounded-xl border border-amber-300/20 bg-background/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{selection.fixtureLabel}</p>
                  <p className="mt-0.5 text-[10px] text-muted-text">
                    {selection.marketName} · {selection.selectionLabel}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-amber-200">
                    {score ? `${score.home} - ${score.away}` : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-text">Final</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-amber-300/80">Amount won</p>
          <p className="text-2xl font-bold tabular-nums text-amber-200">
            {formatTzs(ticket.payoutMinor)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
          <p className="text-sm font-semibold tabular-nums">{formatTzs(ticket.stakeMinor)}</p>
        </div>
      </div>
    </>
  )
}

function SettledTicketBody({ ticket }: { ticket: BetTicketView }) {
  return (
    <>
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
          <p className="text-[10px] uppercase tracking-wide text-muted-text">Payout</p>
          <p className="text-sm font-bold tabular-nums text-accent">
            {formatTzs(ticket.payoutMinor)}
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
    </>
  )
}

function EmptyTickets({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        {tab === 'OPEN' ? <Ticket className="h-6 w-6" /> : <History className="h-6 w-6" />}
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">
        {tab === 'OPEN' ? 'No open bets.' : 'No settled bets yet.'}
      </h2>
      <p className="mt-1 text-sm text-muted-text">
        {tab === 'OPEN'
          ? 'Build a slip from the sportsbook and your open tickets will appear here.'
          : 'Settled, cashed out and void tickets will appear here.'}
      </p>
      {tab === 'OPEN' ? (
        <Link
          href="/bet/sports"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse fixtures
        </Link>
      ) : null}
    </div>
  )
}

export function TicketsList({ tickets }: { tickets: BetTicketView[] }) {
  const router = useRouter()
  const { refreshWallet } = useBetSlip()
  const [tab, setTab] = useState<Tab>('OPEN')
  const [events, setEvents] = useState<EventMap>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const hasOpenTickets = tickets.some(ticket => ticket.status === 'OPEN')

  useEffect(() => {
    if (!hasOpenTickets) return
    let active = true

    async function loadEvents() {
      try {
        const response = await fetch('/api/bet/catalog', { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json().catch(() => ({}))) as { events?: BetEvent[] }
        if (!active) return
        setEvents(
          Object.fromEntries((payload.events ?? []).map(event => [event.id, event])),
        )
      } catch {
        return
      }
    }

    void loadEvents()
    const timer = setInterval(loadEvents, 30_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [hasOpenTickets])

  if (tickets.length === 0) {
    return <EmptyTickets tab="OPEN" />
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

  const openTickets = tickets.filter(ticket => ticket.status === 'OPEN')
  const historyTickets = tickets.filter(ticket => ticket.status !== 'OPEN')
  const visibleTickets = tab === 'OPEN' ? openTickets : historyTickets

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface/70 p-1">
        {(['OPEN', 'HISTORY'] as const).map(candidate => {
          const active = tab === candidate
          const count = candidate === 'OPEN' ? openTickets.length : historyTickets.length
          return (
            <button
              key={candidate}
              type="button"
              onClick={() => setTab(candidate)}
              aria-pressed={active}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                active
                  ? 'bg-accent text-background'
                  : 'text-muted-text hover:bg-background/40 hover:text-main-text'
              }`}
            >
              {candidate === 'OPEN' ? 'Open' : 'History'}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? 'bg-background/20 text-background' : 'bg-background/50 text-muted-text'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {visibleTickets.length === 0 ? <EmptyTickets tab={tab} /> : null}

      {visibleTickets.map(ticket => {
        const busy = busyId === ticket.id
        const live = isLiveTicket(ticket, events)
        const won = ticket.status === 'WON'
        const classes = won
          ? 'rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-400/10 via-surface to-surface p-4 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]'
          : live
            ? 'rounded-2xl border border-red-400/50 bg-surface/90 p-4 shadow-[0_0_24px_rgba(248,113,113,0.08)]'
            : ticket.status === 'OPEN'
              ? 'rounded-2xl border border-border bg-surface/80 p-4'
              : 'rounded-2xl border border-border bg-surface/70 p-4 opacity-90'

        return (
          <article key={ticket.id} className={classes}>
            {ticket.status === 'OPEN' ? (
              live ? (
                <LiveTicketBody ticket={ticket} events={events} />
              ) : (
                <WaitingTicketBody ticket={ticket} />
              )
            ) : won ? (
              <WonTicketBody ticket={ticket} />
            ) : (
              <SettledTicketBody ticket={ticket} />
            )}

            {ticket.status === 'OPEN' ? (
              <div className="mt-4 space-y-2">
                {live ? (
                  <button
                    type="button"
                    onClick={() => runAction(ticket, 'cashout')}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    Cash out
                    {ticket.cashoutMinor !== null ? ` ${formatTzs(ticket.cashoutMinor)}` : ''}
                  </button>
                ) : null}
                {ticket.demoEligible ? (
                  <button
                    type="button"
                    onClick={() => runAction(ticket, 'settle-demo')}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-text hover:border-accent/40 hover:text-accent disabled:opacity-60"
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
          </article>
        )
      })}
    </div>
  )
}
