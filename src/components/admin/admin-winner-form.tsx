'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  Plus,
  Search,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react'
import { formatOdds, formatTzs } from '@/lib/bet/format'
import { applyVat, VAT_PERCENT } from '@/lib/bet/vat'

export interface WinnerUserOption {
  id: string
  name: string | null
  email: string
  balanceMinor: number
}

interface SelectionDraft {
  fixtureLabel: string
  competition: string
  marketName: string
  selectionLabel: string
  odds: string
  homeScore: string
  awayScore: string
}

interface WinnerResponse {
  error?: string
  shareUrl?: string
  winner?: {
    code: string
    netPayoutMinor: number
    grossPayoutMinor: number
    vatMinor: number
    totalOdds: number
    ticketCode: string | null
  }
}

const MIN_ODDS = 1.01
const MAX_ODDS = 1000

function emptySelection(): SelectionDraft {
  return {
    fixtureLabel: '',
    competition: '',
    marketName: 'Match result',
    selectionLabel: '',
    odds: '',
    homeScore: '',
    awayScore: '',
  }
}

function normalizeOdds(value: string): number {
  const odds = Number(value)
  return Number.isFinite(odds) ? Math.round(odds * 100) / 100 : 0
}

function combinedOdds(rows: SelectionDraft[]): number {
  if (rows.length === 0) return 0
  let total = 1
  for (const row of rows) {
    const odds = normalizeOdds(row.odds)
    if (!Number.isFinite(odds) || odds < MIN_ODDS || odds > MAX_ODDS) return 0
    total *= odds
  }
  return Math.max(1, Math.round(total * 100) / 100)
}

function scoreValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const score = Number(trimmed)
  return Number.isInteger(score) && score >= 0 ? score : null
}

export function AdminWinnerForm({ users }: { users: WinnerUserOption[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [stake, setStake] = useState('1000')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<SelectionDraft[]>([emptySelection()])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WinnerResponse | null>(null)

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter(user =>
      `${user.name ?? ''} ${user.email}`.toLowerCase().includes(needle),
    )
  }, [users, query])

  const selectedUser = users.find(user => user.id === userId) ?? null
  const stakeMinor = Number(stake)
  const totalOdds = combinedOdds(rows)
  const grossPayoutMinor =
    Number.isFinite(stakeMinor) && stakeMinor > 0 && totalOdds > 0
      ? Math.floor(stakeMinor * totalOdds)
      : 0
  const vat = applyVat(grossPayoutMinor)

  function updateRow(index: number, patch: Partial<SelectionDraft>) {
    setResult(null)
    setError(null)
    setRows(current =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    )
  }

  function addRow() {
    setResult(null)
    setError(null)
    setRows(current => [...current, emptySelection()])
  }

  function removeRow(index: number) {
    setResult(null)
    setError(null)
    setRows(current => current.filter((_, position) => position !== index))
  }

  function scoreFor(row: SelectionDraft): { home: number; away: number } | null {
    const home = scoreValue(row.homeScore)
    const away = scoreValue(row.awayScore)
    if (home === null || away === null) return null
    return { home, away }
  }

  async function onSubmit() {
    if (pending) return
    setError(null)
    setResult(null)

    if (!selectedUser) {
      setError('Choose the registered user who should receive this winner payout.')
      return
    }
    if (!Number.isInteger(stakeMinor) || stakeMinor < 500 || stakeMinor > 500_000) {
      setError('Stake must be a whole amount between 500 and 500,000 TZS.')
      return
    }
    if (rows.length === 0) {
      setError('Add at least one winning selection.')
      return
    }
    for (const [index, row] of rows.entries()) {
      if (!row.fixtureLabel.trim()) {
        setError(`Selection ${index + 1}: enter the teams or fixture.`)
        return
      }
      if (!row.marketName.trim() || !row.selectionLabel.trim()) {
        setError(`Selection ${index + 1}: enter the market and winning selection.`)
        return
      }
      const odds = normalizeOdds(row.odds)
      if (!Number.isFinite(odds) || odds < MIN_ODDS || odds > MAX_ODDS) {
        setError(`Selection ${index + 1}: odds must be between ${MIN_ODDS} and ${MAX_ODDS}.`)
        return
      }
      if (row.homeScore.trim() || row.awayScore.trim()) {
        if (scoreFor(row) === null) {
          setError(`Selection ${index + 1}: enter both final-score values or leave both blank.`)
          return
        }
      }
    }

    setPending(true)
    try {
      const response = await fetch('/api/admin/winners', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          title: title.trim() || undefined,
          stakeMinor,
          note: note.trim() || undefined,
          selections: rows.map(row => ({
            fixtureLabel: row.fixtureLabel.trim(),
            competition: row.competition.trim() || undefined,
            marketName: row.marketName.trim(),
            selectionLabel: row.selectionLabel.trim(),
            odds: normalizeOdds(row.odds),
            finalScore: scoreFor(row),
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as WinnerResponse
      if (!response.ok || !payload.winner) {
        setError(payload.error ?? 'Could not create the winner slip.')
        return
      }
      setResult(payload)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-main-text">Assign a winner</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-text">
            Pick a registered user, add the winning teams and selections, then set the stake and
            odds. The payout is credited to their wallet minus {VAT_PERCENT}% VAT.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">
              <UserRound className="h-3.5 w-3.5 text-accent" />
              Registered user
            </p>
            <label className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-2 focus-within:border-accent/60">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name or email"
                className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
              />
            </label>
            <select
              value={userId}
              onChange={event => {
                setUserId(event.target.value)
                setResult(null)
                setError(null)
              }}
              className="mt-2 w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
            >
              <option value="">Choose a user</option>
              {filteredUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name ? `${user.name} - ${user.email}` : user.email}
                </option>
              ))}
            </select>
            {selectedUser ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/25 bg-accent/10 px-2.5 py-2 text-[11px]">
                <span className="min-w-0 truncate text-accent">
                  {selectedUser.name ?? 'Registered user'} ({selectedUser.email})
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-main-text">
                  Wallet {formatTzs(selectedUser.balanceMinor)}
                </span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="mt-2 text-[11px] text-amber-200">No registered users match that search.</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
                Winner slip title (optional)
              </span>
              <input
                type="text"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={120}
                placeholder="e.g. Weekend jackpot winner"
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
                Stake deposited (TZS)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={500}
                max={500000}
                step={100}
                value={stake}
                onChange={event => setStake(event.target.value)}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
              Internal note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={event => setNote(event.target.value)}
              maxLength={280}
              placeholder="Reason for this payout"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
            />
          </label>
        </div>

        <div className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
            Payout preview
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-text">Stake</dt>
              <dd className="font-semibold tabular-nums text-main-text">
                {Number.isFinite(stakeMinor) ? formatTzs(stakeMinor) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-text">Total odds</dt>
              <dd className="font-semibold tabular-nums text-main-text">
                {totalOdds > 0 ? formatOdds(totalOdds) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-text">Gross payout</dt>
              <dd className="font-semibold tabular-nums text-main-text">
                {vat.grossMinor > 0 ? formatTzs(vat.grossMinor) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-text">VAT ({VAT_PERCENT}%)</dt>
              <dd className="font-semibold tabular-nums text-red-300">
                {vat.vatMinor > 0 ? `-${formatTzs(vat.vatMinor)}` : '-'}
              </dd>
            </div>
          </dl>
          <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">Wallet credit</p>
            <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-amber-200">
              {vat.netPayoutMinor > 0 ? formatTzs(vat.netPayoutMinor) : '-'}
            </p>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-text">
            The winner ticket and wallet transaction are created together, so the credit is
            idempotent.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-text">
            Winning selections
          </p>
          <span className="text-[11px] text-muted-text">{rows.length} selections</span>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-surface/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Selection {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  aria-label={`Remove selection ${index + 1}`}
                  className="rounded-lg border border-border bg-surface p-1.5 text-muted-text transition-colors hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] text-muted-text">Teams / fixture</span>
                  <input
                    type="text"
                    value={row.fixtureLabel}
                    onChange={event => updateRow(index, { fixtureLabel: event.target.value })}
                    placeholder="e.g. Yanga vs Simba"
                    className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-muted-text">Competition</span>
                  <input
                    type="text"
                    value={row.competition}
                    onChange={event => updateRow(index, { competition: event.target.value })}
                    placeholder="e.g. NBC Premier League"
                    className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-muted-text">Market</span>
                  <input
                    type="text"
                    value={row.marketName}
                    onChange={event => updateRow(index, { marketName: event.target.value })}
                    placeholder="e.g. Match result"
                    className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-muted-text">Winning selection</span>
                  <input
                    type="text"
                    value={row.selectionLabel}
                    onChange={event => updateRow(index, { selectionLabel: event.target.value })}
                    placeholder="e.g. Yanga to win"
                    className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-muted-text">Odds</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_ODDS}
                    max={MAX_ODDS}
                    step={0.01}
                    value={row.odds}
                    onChange={event => updateRow(index, { odds: event.target.value })}
                    placeholder="1.85"
                    className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs font-semibold tabular-nums text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                  />
                </label>
                <div className="block">
                  <span className="mb-1 block text-[10px] text-muted-text">
                    Final score (optional)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={50}
                      value={row.homeScore}
                      onChange={event => updateRow(index, { homeScore: event.target.value })}
                      placeholder="Home"
                      aria-label={`Selection ${index + 1} home score`}
                      className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-center text-xs font-semibold tabular-nums text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                    />
                    <span className="text-muted-text">-</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={50}
                      value={row.awayScore}
                      onChange={event => updateRow(index, { awayScore: event.target.value })}
                      placeholder="Away"
                      aria-label={`Selection ${index + 1} away score`}
                      className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-center text-xs font-semibold tabular-nums text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 20}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add selection
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
          {pending ? 'Crediting winner...' : 'Assign winner and credit wallet'}
        </button>
        {error ? (
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : null}
      </div>

      {result?.winner ? (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
            <CircleCheck className="h-3.5 w-3.5" />
            Winner credited
          </p>
          <p className="mt-2 text-xs text-main-text">
            {formatTzs(result.winner.netPayoutMinor)} added to the wallet. Gross{' '}
            {formatTzs(result.winner.grossPayoutMinor)} minus {formatTzs(result.winner.vatMinor)}{' '}
            VAT.
          </p>
          <p className="mt-1 text-[11px] text-muted-text">
            Winner code{' '}
            <span className="font-mono text-sm font-bold tracking-[0.18em] text-amber-200">
              {result.winner.code}
            </span>
            {result.winner.ticketCode ? (
              <>
                {' '}
                | Ticket{' '}
                <span className="font-mono text-amber-200">{result.winner.ticketCode}</span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={result.shareUrl ?? `/bet/winner/${result.winner.code}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-amber-200 hover:underline"
            >
              Open winner slip
            </a>
            <span className="text-[10px] text-muted-text">
              The user can now see the payout in their wallet and withdraw it.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
