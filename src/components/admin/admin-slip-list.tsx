'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, Copy, Loader2, Lock, LockOpen, Ticket } from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'

export interface AdminSlipSelectionView {
  fixtureLabel: string
  marketName: string
  selectionLabel: string
  odds: number
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
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function act(code: string, action: 'freeze' | 'unfreeze') {
    if (pendingCode) return
    setPendingCode(code)
    setError(null)
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
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingCode(null)
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

  if (slips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Ticket className="h-5 w-5" />
        </span>
        <p className="mt-4 text-sm font-semibold text-main-text">No bet slips yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs">
          Generate your first slip above. It will appear here with its share link, payment status
          and freeze controls.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-red-300">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
      {slips.map(slip => {
        const busy = pendingCode === slip.code
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
                ) : (
                  <button
                    type="button"
                    onClick={() => act(slip.code, 'freeze')}
                    disabled={busy || slip.status !== 'OPEN'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-400/50 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    Freeze
                  </button>
                )}
              </div>
            </div>

            {slip.frozenReason ? (
              <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                {slip.frozenReason}
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
          </article>
        )
      })}
    </div>
  )
}