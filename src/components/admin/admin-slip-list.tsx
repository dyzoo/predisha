'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  Ban,
  CircleAlert,
  CircleCheck,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Play,

  Radio,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Trophy,
} from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import type { AdminSlipFixtureStateView } from '@/lib/bet/slips'
import { formatLiveMinute } from '@/lib/bet/types'


export interface AdminSlipSelectionView {
  fixtureId: string
  fixtureLabel: string

  marketName: string
  selectionLabel: string
  odds: number
  kickoffIso?: string | null
  kickoffLabel?: string | null
  finalScore?: { home: number; away: number } | null
  liveScore?: { home: number; away: number } | null
  liveMinute?: number | null
}



export interface AdminSlipEntryView {
  id: string
  phoneMasked: string
  userId: string | null
  userName: string | null
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
  timeMode: 'ORIGINAL' | 'MANUAL' | 'SIMULATED'
  selectionSource: 'CATALOG' | 'RANDOM'
  manualKickoffAt: string | null
  simulatedDurationMinutes: number
  liveStartedAt: string | null
  frozen: boolean
  frozenReason: string | null
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
  entryCount: number
  paidCount: number
  entries: AdminSlipEntryView[]
  selections: AdminSlipSelectionView[]
  matches?: AdminSlipFixtureStateView[]
}

type ScoreDraft = { home: string; away: string }
type LiveScoreDraft = { home: string; away: string; minute: string }

function statusClass(status: AdminSlipListItemView['status']): string {

  if (status === 'OPEN') return 'border-accent/30 bg-accent/10 text-accent'
  if (status === 'FROZEN') return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  return 'border-red-400/30 bg-red-400/10 text-red-200'
}

function freezeLabel(iso: string): string {
  return formatDateTimeLabel(iso)
}

function nextKickoffIso(slip: AdminSlipListItemView): string | null {
  const now = Date.now()
  const upcoming = slip.selections
    .map(selection => selection.kickoffIso)
    .filter((value): value is string => Boolean(value))
    .filter(value => !Number.isNaN(new Date(value).getTime()))
    .filter(value => new Date(value).getTime() > now)
    .sort()
  return upcoming[0] ?? null
}

function timeLabel(slip: AdminSlipListItemView): string {
  const prefix =
    slip.timeMode === 'SIMULATED'
      ? `Simulated ${slip.simulatedDurationMinutes}min`
      : slip.timeMode === 'MANUAL'
        ? 'Manual time'
        : 'Original time'
  if (slip.liveStartedAt) return `${prefix} • started ${freezeLabel(slip.liveStartedAt)}`
  const next = nextKickoffIso(slip)
  if (next) return `${prefix} • starts ${freezeLabel(next)}`
  const iso = slip.manualKickoffAt ?? slip.autoFreezeAt
  return `${prefix} • ${freezeLabel(iso)}`
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
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, Record<string, ScoreDraft>>>({})
  const [liveScoreDrafts, setLiveScoreDrafts] = useState<
    Record<string, Record<string, LiveScoreDraft>>
  >({})
  const [resultsOpenCode, setResultsOpenCode] = useState<string | null>(null)
  const [liveOpenCode, setLiveOpenCode] = useState<string | null>(null)
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

  async function act(
    code: string,
    action:
      | 'freeze'
      | 'unfreeze'
      | 'close'
      | 'start-live'
      | 'start-match'
      | 'force-start-matches'
      | 'set-live-score'
      | 'finish-match',
    results?: Array<{ fixtureId: string; homeScore: number; awayScore: number; minute?: number }>,
  ) {

    if (pendingCode) return
    setPendingCode(code)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/admin/bets/${encodeURIComponent(code)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(results ? { results } : {}) }),
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
            : action === 'start-live' || action === 'start-match'
              ? `Slip ${code} is live.`
              : action === 'force-start-matches'
                ? `All matches on slip ${code} were forced live now.`
              : action === 'set-live-score'
                ? `Live score updated for ${results?.length ?? 0} match(es).`
                : action === 'finish-match'
                  ? `Slip ${code} is marked as full time.${results?.length ? ` ${results.length} result(s) applied.` : ''}`

                  : `Slip ${code} is closed permanently.`,
      )
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPendingCode(null)
    }
  }

  function updateScoreDraft(code: string, fixtureId: string, side: keyof ScoreDraft, value: string) {
    setScoreDrafts(current => {
      const slipDrafts = current[code] ?? {}
      const draft = slipDrafts[fixtureId] ?? { home: '', away: '' }
      return {
        ...current,
        [code]: {
          ...slipDrafts,
          [fixtureId]: { ...draft, [side]: value },
        },
      }
    })
  }

  async function finishWithResults(slip: AdminSlipListItemView) {
    const drafts = scoreDrafts[slip.code] ?? {}
    const scored = slip.selections.map(selection => {
      const draft = drafts[selection.fixtureId]
      const home = draft?.home ?? (selection.finalScore ? String(selection.finalScore.home) : '')
      const away = draft?.away ?? (selection.finalScore ? String(selection.finalScore.away) : '')
      return { selection, home, away }
    })
    const filled = scored.filter(score => score.home !== '' || score.away !== '')
    const invalid = filled.some(score => {
      const home = Number(score.home)
      const away = Number(score.away)
      return (
        score.home === '' ||
        score.away === '' ||
        !Number.isInteger(home) ||
        !Number.isInteger(away) ||
        home < 0 ||
        home > 50 ||
        away < 0 ||
        away > 50
      )
    })
    if (invalid) {
      setError('Scores must be whole numbers between 0 and 50.')
      return
    }
    const results = filled.map(score => ({
      fixtureId: score.selection.fixtureId,
      homeScore: Number(score.home),
      awayScore: Number(score.away),
    }))
    await act(slip.code, 'finish-match', results)
    setResultsOpenCode(null)
  }

  function updateLiveScoreDraft(
    code: string,
    fixtureId: string,
    side: keyof LiveScoreDraft,
    value: string,
  ) {
    setLiveScoreDrafts(current => {
      const slipDrafts = current[code] ?? {}
      const draft = slipDrafts[fixtureId] ?? { home: '', away: '', minute: '' }
      return {
        ...current,
        [code]: {
          ...slipDrafts,
          [fixtureId]: { ...draft, [side]: value },
        },
      }
    })
  }

  async function saveLiveScores(slip: AdminSlipListItemView) {
    const drafts = liveScoreDrafts[slip.code] ?? {}
    const scored = slip.selections.map(selection => {
      const draft = drafts[selection.fixtureId]
      return {
        selection,
        home: draft?.home ?? (selection.liveScore ? String(selection.liveScore.home) : ''),
        away: draft?.away ?? (selection.liveScore ? String(selection.liveScore.away) : ''),
        minute:
          draft?.minute ?? (selection.liveMinute ? String(selection.liveMinute) : ''),
      }
    })
    const filled = scored.filter(
      score => score.home !== '' || score.away !== '' || score.minute !== '',
    )
    if (!filled.length) {
      setError('Enter at least one live score.')
      return
    }
    const invalid = filled.some(score => {
      const home = Number(score.home)
      const away = Number(score.away)
      const minute = score.minute === '' ? null : Number(score.minute)
      return (
        score.home === '' ||
        score.away === '' ||
        !Number.isInteger(home) ||
        !Number.isInteger(away) ||
        home < 0 ||
        home > 50 ||
        away < 0 ||
        away > 50 ||
        (minute !== null &&
          (!Number.isInteger(minute) || minute < 1 || minute > 120))
      )
    })
    if (invalid) {
      setError('Scores must be 0-50 and minutes must be 1-120.')
      return
    }
    const results = filled.map(score => ({
      fixtureId: score.selection.fixtureId,
      homeScore: Number(score.home),
      awayScore: Number(score.away),
      ...(score.minute === '' ? {} : { minute: Number(score.minute) }),
    }))
    await act(slip.code, 'set-live-score', results)
    setLiveOpenCode(null)
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

  async function settleWin(
    entryId: string,
    action: 'simulate-win' | 'assign-win' = 'simulate-win',
  ) {
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
          body: JSON.stringify({ action }),
        },

      )
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        payoutMinor?: number
        winner?: { netPayoutMinor: number }
      }
      if (!response.ok) {
        setError(
          payload.error ??
            (action === 'assign-win'
              ? 'Could not assign this shared bet as a winner.'
              : 'Could not settle this ticket as a winner.'),
        )
        return
      }
      const payoutMinor = payload.payoutMinor ?? payload.winner?.netPayoutMinor ?? 0
      setSuccess(
        action === 'assign-win'
          ? `Shared bet assigned as won. ${formatTzs(payoutMinor)} credited to the wallet.`
          : `Ticket settled as won. ${formatTzs(payoutMinor)} credited to the wallet.`,
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
          slip.status !== 'CLOSED' &&
          (slip.paidCount > 0 ||
            slip.entries.some(entry => entry.status === 'PENDING' || Boolean(entry.ticketId)))
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
                  {slip.selectionSource === 'RANDOM' ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Random
                    </span>
                  ) : null}
                  {slip.liveStartedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                      <Radio className="h-3 w-3" />
                      Live
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 truncate text-xs text-muted-text">
                  {slip.title ?? 'Untitled slip'} · {timeLabel(slip)}
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
                <Link
                  href={`/bet/share/${slip.code}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-400/50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit / republish
                </Link>
                {slip.status !== 'CLOSED' && !slip.liveStartedAt ? (
                  <>
                    <button
                      type="button"
                      onClick={() => act(slip.code, 'start-match')}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200 transition-colors hover:border-red-400/50 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Start match
                    </button>
                    <button
                      type="button"
                      onClick={() => act(slip.code, 'force-start-matches')}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-400/50 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Force all now
                    </button>
                  </>
                ) : null}
                {slip.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    onClick={() =>
                      setResultsOpenCode(current => (current === slip.code ? null : slip.code))
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 disabled:opacity-60"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Set scores
                  </button>
                ) : null}
                {slip.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResultsOpenCode(null)
                      setLiveOpenCode(current => (current === slip.code ? null : slip.code))
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200 transition-colors hover:border-red-400/50 disabled:opacity-60"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Set live score
                  </button>
                ) : null}
                {slip.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    onClick={() => act(slip.code, 'finish-match')}

                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                    Finish match
                  </button>
                ) : null}
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
                        ? 'Close this slip before deleting it.'
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
                This slip has paid, pending or placed entries. Close it to enable deletion.
              </p>
            ) : null}

            {liveOpenCode === slip.code && slip.status !== 'CLOSED' ? (
              <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/5 p-3">
                <p className="text-[11px] font-semibold text-main-text">Enter live scores</p>
                <p className="mt-0.5 text-[10px] text-muted-text">
                  Updates shared slips and open tickets immediately. Use 46 for half time and 91+ for stoppage time.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {slip.selections.map((selection, index) => {
                    const draft = liveScoreDrafts[slip.code]?.[selection.fixtureId]
                    return (
                      <label
                        key={`${slip.id}:live:${index}`}
                        className="rounded-lg border border-border bg-background/40 p-2"
                      >
                        <span className="block truncate text-[10px] text-main-text">
                          {index + 1}. {selection.fixtureLabel}
                        </span>
                        {selection.liveScore || selection.liveMinute ? (
                          <span className="mt-0.5 block text-[10px] text-muted-text">
                            Current: {selection.liveScore ? `${selection.liveScore.home} - ${selection.liveScore.away}` : '- - -'} · {formatLiveMinute(selection.liveMinute) ?? 'no minute'}
                          </span>
                        ) : null}
                        <span className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={
                              draft?.home ??
                              (selection.liveScore ? String(selection.liveScore.home) : '')
                            }
                            onChange={event =>
                              updateLiveScoreDraft(slip.code, selection.fixtureId, 'home', event.target.value)
                            }
                            aria-label={`${selection.fixtureLabel} live home score`}
                            className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-red-400/60"
                          />
                          <span className="text-[10px] text-muted-text">-</span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={
                              draft?.away ??
                              (selection.liveScore ? String(selection.liveScore.away) : '')
                            }
                            onChange={event =>
                              updateLiveScoreDraft(slip.code, selection.fixtureId, 'away', event.target.value)
                            }
                            aria-label={`${selection.fixtureLabel} live away score`}
                            className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-red-400/60"
                          />
                          <span className="text-[10px] text-muted-text">@</span>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={draft?.minute ?? (selection.liveMinute ? String(selection.liveMinute) : '')}
                            onChange={event =>
                              updateLiveScoreDraft(slip.code, selection.fixtureId, 'minute', event.target.value)
                            }
                            aria-label={`${selection.fixtureLabel} live minute`}
                            placeholder="min"
                            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-red-400/60"
                          />
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveLiveScores(slip)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-red-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                    Update live score
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveOpenCode(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-text hover:text-main-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {resultsOpenCode === slip.code && slip.status !== 'CLOSED' ? (
              <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
                <p className="text-[11px] font-semibold text-main-text">Enter final scores</p>
                <p className="mt-0.5 text-[10px] text-muted-text">
                  Blank matches stay pending unless a real result is available from football-data.org.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {slip.selections.map((selection, index) => {
                    const draft = scoreDrafts[slip.code]?.[selection.fixtureId]
                    return (
                      <label
                        key={`${slip.id}:score:${index}`}
                        className="rounded-lg border border-border bg-background/40 p-2"
                      >
                        <span className="block truncate text-[10px] text-main-text">
                          {index + 1}. {selection.fixtureLabel}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={
                              draft?.home ??
                              (selection.finalScore ? String(selection.finalScore.home) : '')
                            }
                            onChange={event =>
                              updateScoreDraft(slip.code, selection.fixtureId, 'home', event.target.value)
                            }
                            aria-label={`${selection.fixtureLabel} home score`}
                            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-emerald-400/60"
                          />
                          <span className="text-[10px] text-muted-text">-</span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={
                              draft?.away ??
                              (selection.finalScore ? String(selection.finalScore.away) : '')
                            }
                            onChange={event =>
                              updateScoreDraft(slip.code, selection.fixtureId, 'away', event.target.value)
                            }
                            aria-label={`${selection.fixtureLabel} away score`}
                            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-emerald-400/60"
                          />
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void finishWithResults(slip)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                    Finish with scores
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsOpenCode(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-text hover:text-main-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <ul className="mt-3 space-y-1.5">

              {slip.selections.map((selection, index) => {
                const matchState = slip.matches?.find(
                  item => item.fixtureId === selection.fixtureId,
                )
                return (
                  <li
                    key={`${slip.id}:${index}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 text-[11px] text-main-text">
                      <span className="block truncate">
                        {selection.fixtureLabel} · {selection.marketName} · {selection.selectionLabel}
                      </span>
                      {selection.kickoffLabel || selection.kickoffIso ? (
                        <span className="block truncate text-[10px] text-muted-text">
                          Starts: {selection.kickoffLabel ?? freezeLabel(selection.kickoffIso as string)}
                        </span>
                      ) : null}
                      {matchState ? (
                        <span
                          className={`block truncate text-[10px] font-semibold tabular-nums ${matchState.live ? 'text-emerald-300' : 'text-amber-200'}`}
                        >
                          {matchState.live
                            ? matchState.label || formatLiveMinute(matchState.minute) || 'LIVE'
                            : matchState.finished
                              ? 'Full time'
                              : `Starts ${formatDateTimeLabel(matchState.kickoffIso)}`}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-text">
                      {formatOdds(selection.odds)}
                    </span>
                  </li>
                )
              })}
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
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Net payout</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-accent">{formatTzs(slip.netPayoutMinor)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-text">Entries</dt>
                <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
                  {slip.paidCount}/{slip.entryCount} paid
                </dd>
              </div>
            </dl>
            <p className="mt-1.5 text-[10px] text-muted-text">
              Gross return {formatTzs(slip.potentialReturnMinor)} | VAT 10% {formatTzs(slip.vatMinor)}
            </p>

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
                    const canAssignWin =
                      entry.status === 'PAID' && !entry.ticketId && Boolean(entry.userId)
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
                          {entry.userName ? (
                            <span className="text-accent">{entry.userName}</span>
                          ) : null}
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
                              onClick={() => settleWin(entry.id, 'simulate-win')}
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
                          {canAssignWin ? (
                            <button
                              type="button"
                              onClick={() => settleWin(entry.id, 'assign-win')}
                              disabled={Boolean(pendingEntry)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 transition-colors hover:border-emerald-300/60 disabled:opacity-60"
                            >
                              {retrying ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trophy className="h-3 w-3" />
                              )}
                              Assign win
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
