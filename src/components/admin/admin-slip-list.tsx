'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ban,
  CircleAlert,
  CircleCheck,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Trophy,
} from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'

export interface AdminSlipSelectionView {
  fixtureLabel: string
  marketName: string
  selectionLabel: string
  odds: number
}

export interface AdminSlipEntryView {
  id: string
  phoneMasked: string
  stakeMinor: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
  ticketId: string | null
  ticketCode: string | null
  ticketStatus: string | null
  ticketPayoutMinor: number | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
}

export interface AdminSlipListItemView {
  id: string
  code: string
  title: string | null
  mode: 'LIVE' | 'SANDBOX'
  status: 'OPEN' | 'FROZEN' | 'CLOSED'
  frozen: boolean
  frozenReason: string | null
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  entryCount: number
  paidCount: number
  entries: AdminSlipEntryView[]
  selections: AdminSlipSelectionView[]
}

function statusClass(status: AdminSlipListItemView['status']): string {
  if (status === 'OPEN') return 'border-accent/30 bg-accent/10 text-accent'
  if (status === 'FROZEN') return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  return 'border-red-400/30 bg-red-400/10 text-red-200'
}

function freezeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function AdminSlipList({ slips }: { slips: AdminSlipListItemView[] }) {
  const router = useRouter()
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [pendingEntry, setPendingEntry] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    code: string
    action: 'close' | 'delete'
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminSlipListItemView['status']>('ALL')
  const [modeFilter, setModeFilter] = useState<'ALL' | AdminSlipListItemView['mode']>('ALL')

  const filteredSlips = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return slips.filter(slip => {
      if (statusFilter !== 'ALL' && slip.status !== statusFilter) return false
      if (modeFilter !== 'ALL' && slip.mode !== modeFilter) return false
      if (!needle) return true
      const haystack = [
        slip.code,
        slip.title ?? '',
        ...slip.entries.map(entry => entry.phoneMasked),
        ...slip.entries.map(entry => entry.ticketCode ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [slips, query, statusFilter, modeFilter])

  async function act(code: string, action: 'freeze' | 'unfreeze' | 'close') {
    if (pendingCode) return
    setPendingCode(code)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/admin/bets/${encodeURIComponent(code)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Could not update this slip.')
        return
      }
      setConfirmAction(null)
      setSuccess(
        action === 'freeze'
          ? `Slip ${code} is frozen.`
          : action === 'unfreeze'
            ? `Slip ${code} is open again.`
            : `Slip ${code} is closed permanently.`,
      )
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingCode(null)
    }
  }

  async function deleteSlip(code: string) {
    if (pendingCode) return
    setPendingCode(code)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/admin/bets/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Could not delete this slip.')
        return
      }
      setConfirmAction(null)
      setSuccess(`Slip ${code} was deleted.`)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingCode(null)
    }
  }

  async function simulateWin(entryId: string) {
    if (pendingEntry) return
    setPendingEntry(entryId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(
        `/api/admin/bets/entries/${encodeURIComponent(entryId)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulate-win' }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        payoutMinor?: number
      }
      if (!response.ok) {
        setError(payload.error ?? 'Could not settle this ticket as a winner.')
        return
      }
      setSuccess(
        `Ticket settled as won. ${formatTzs(payload.payoutMinor ?? 0)} credited to the wallet.`,
      )
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingEntry(null)
    }
  }

  async function copyLink(code: string) {
    const link = `${window.location.origin}/bet/share/${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedCode(code)
    } catch {
      setCopiedCode(null)
    }
  }

  async function retryEntry(entryId: string) {
    if (pendingEntry) return
    setPendingEntry(entryId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(
        `/api/admin/bets/entries/${encodeURIComponent(entryId)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry' }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Could not place this bet. Try again later.')
        return
      }
      setSuccess('The bet was placed successfully.')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingEntry(null)
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-[11px] text-red-200"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] text-accent"
        >
          <CircleCheck className="h-3.5 w-3.5 shrink-0" />
          {success}
        </p>
      ) : null}

      {slips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/60 p-2">
          <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 focus-within:border-accent/60">
            <Search className="h-3.5 w-3.5 text-muted-text" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search code, title, phone or ticket"
              className="w-full bg-transparent text-[11px] text-main-text outline-none placeholder:text-muted-text/70"
            />
          </label>
          <select
            value={statusFilter}
            onChange={event =>
              setStatusFilter(event.target.value as 'ALL' | AdminSlipListItemView['status'])
            }
            aria-label="Filter by status"
            className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[11px] font-semibold text-main-text outline-none focus:border-accent/60"
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            value={modeFilter}
            onChange={event =>
              setModeFilter(event.target.value as 'ALL' | AdminSlipListItemView['mode'])
            }
            aria-label="Filter by mode"
            className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[11px] font-semibold text-main-text outline-none focus:border-accent/60"
          >
            <option value="ALL">All modes</option>
            <option value="LIVE">Live</option>
            <option value="SANDBOX">Sandbox</option>
          </select>
        </div>
      ) : null}

      {slips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Ticket className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm font-semibold text-main-text">No bet slips yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs">
            Generate your first slip above. It will appear here with its share link, payment
            status and management controls.
          </p>
        </div>
      ) : null}

      {slips.length > 0 && filteredSlips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
          <p className="text-sm font-semibold text-main-text">No slips match those filters</p>
          <p className="mx-auto mt-1 max-w-sm text-xs">
            Try a different search term or reset the status and mode filters.
          </p>
        </div>
      ) : null}

      {filteredSlips.map(slip => {
        const busy = pendingCode === slip.code
        const confirming = confirmAction?.code === slip.code ? confirmAction.action : null
        const protectedEntries =
          slip.paidCount > 0 ||
          slip.entries.some(entry => entry.status === 'PENDING' || Boolean(entry.ticketId))
        return (
          <article key={slip.id} className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-main-text">
                  <span className="font-mono tracking-[0.18em] text-accent">{slip.code}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(slip.status)}`}>
                    {slip.status}
                  </span>
                  <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                    {slip.mode}
                  </span>
                </p>
                <p className="mt-1 truncate text-xs text-muted-text">
                  {slip.title ?? 'Untitled slip'} · auto-freezes {freezeLabel(slip.autoFreezeAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(slip.code)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedCode === slip.code ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={`/bet/share/${slip.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
                  Open
                </a>
                {slip.status === 'FROZEN' ? (
                  <button
                    type="button"
                    onClick={() => act(slip.code, 'unfreeze')}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockOpen className="h-3.5 w-3.5" />}
                    Reopen
                  </button>
                ) : slip.status === 'OPEN' ? (
                  <button
                    type="button"
                    onClick={() => act(slip.code, 'freeze')}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-400/50 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    Freeze
                  </button>
                ) : null}
                {slip.status !== 'CLOSED' ? (
                  confirming === 'close' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => act(slip.code, 'close')}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-red-200 transition-colors hover:border-red-400/60 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        Confirm close
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="text-[11px] font-semibold text-muted-text hover:text-main-text"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ code: slip.code, action: 'close' })}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200 transition-colors hover:border-red-400/50 disabled:opacity-60"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Close
                    </button>
                  )
                ) : null}
                {confirming === 'delete' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => deleteSlip(slip.code)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-red-100 transition-colors hover:border-red-400/70 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="text-[11px] font-semibold text-muted-text hover:text-main-text"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ code: slip.code, action: 'delete' })}
                    disabled={busy || protectedEntries}
                    title={
                      protectedEntries
                        ? 'Slips with paid, pending or placed entries cannot be deleted.'
                        : 'Delete this slip'
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-text transition-colors hover:border-red-400/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {slip.frozenReason ? (
              <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                {slip.frozenReason}
              </p>
            ) : null}
            {protectedEntries ? (
              <p className="mt-2 text-[10px] text-muted-text">
                This slip has paid, pending or placed entries. Close it instead of deleting it.
              </p>
            ) : null}

            <ul className="mt-3 space-y-1.5">
              {slip.selections.map((selection, index) => (
                <li
                  key={`${slip.id}:${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-[11px] text-main-text">
                    {selection.fixtureLabel} · {selection.marketName} · {selection.selectionLabel}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-text">
                    {formatOdds(selection.odds)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">{formatTzs(slip.stakeMinor)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Odds</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">{formatOdds(slip.totalOdds)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Payout</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-accent">{formatTzs(slip.potentialReturnMinor)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Entries</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
                  {slip.paidCount}/{slip.entryCount} paid
                </dd>
              </div>
            </dl>

            {slip.entries.length > 0 ? (
              <div className="mt-3 rounded-xl border border-border bg-background/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                  Payments
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {slip.entries.map(entry => {
                    const canRetry =
                      !entry.ticketId && (entry.status === 'PAID' || entry.status === 'FAILED')
                    const canSettle =
                      entry.status === 'PAID' &&
                      Boolean(entry.ticketId) &&
                      entry.ticketStatus === 'OPEN'
                    const retrying = pendingEntry === entry.id
                    return (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={
                              entry.status === 'PAID'
                                ? 'font-semibold text-accent'
                                : entry.status === 'FAILED'
                                  ? 'font-semibold text-red-300'
                                  : 'font-semibold text-amber-200'
                            }
                          >
                            {entry.status}
                          </span>
                          <span className="text-muted-text">{entry.phoneMasked}</span>
                          {entry.ticketCode ? (
                            <span className="font-mono text-accent">{entry.ticketCode}</span>
                          ) : null}
                          {entry.ticketStatus ? (
                            <span
                              className={
                                entry.ticketStatus === 'WON'
                                  ? 'font-semibold text-accent'
                                  : entry.ticketStatus === 'OPEN'
                                    ? 'text-muted-text'
                                    : 'font-semibold text-red-300'
                              }
                            >
                              {entry.ticketStatus}
                              {entry.ticketPayoutMinor
                                ? ` ${formatTzs(entry.ticketPayoutMinor)}`
                                : ''}
                            </span>
                          ) : null}
                          {entry.failureReason ? (
                            <span className="text-red-300">{entry.failureReason}</span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {canSettle ? (
                            <button
                              type="button"
                              onClick={() => simulateWin(entry.id)}
                              disabled={Boolean(pendingEntry)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[10px] font-semibold text-amber-200 transition-colors hover:border-amber-300/60 disabled:opacity-60"
                            >
                              {retrying ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trophy className="h-3 w-3" />
                              )}
                              Settle as won
                            </button>
                          ) : null}
                          {canRetry ? (
                            <button
                              type="button"
                              onClick={() => retryEntry(entry.id)}
                              disabled={Boolean(pendingEntry)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:opacity-60"
                            >
                              {retrying ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Retry placement
                            </button>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}