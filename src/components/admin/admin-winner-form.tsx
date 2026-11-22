'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Copy,
  Database,
  Dices,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react'
import {
  ADMIN_MARKET_OPTIONS,
  editableFixtureId,
  findAdminMarketOption,
  fromDateTimeInputValue,
} from '@/lib/bet/admin-selection-options'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import { buildRandomSelections, RANDOM_TEAM_GROUPS } from '@/lib/bet/random-teams'
import type { AdminRecommendationPick } from '@/lib/bet/recommendation'
import { MAX_SELECTIONS, type TicketSelection } from '@/lib/bet/types'
import { applyVat, VAT_PERCENT } from '@/lib/bet/vat'
import type { ActiveWinnerSources } from '@/lib/bet/winners'
import { AdminEditableSelectionFields } from './admin-editable-selection-fields'
import { AdminSelectionPicker } from './admin-selection-picker'

export interface WinnerUserOption {
  id: string
  name: string | null
  email: string
  balanceMinor: number
}

interface SelectionDraft {
  fixtureId: string
  fixtureLabel: string
  competition: string
  kickoffIso: string
  kickoffLabel: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: string
  probability: number
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
const WINNER_STATUSES = ['SCHEDULED', 'LIVE', 'FINISHED'] as const

function todayDateValue(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function selectionToDraft(selection: TicketSelection, index: number): SelectionDraft {
  const kickoffIso = selection.kickoffIso || new Date().toISOString()
  return {
    fixtureId: selection.fixtureId || `source-${index + 1}`,
    fixtureLabel: selection.fixtureLabel,
    competition: selection.competition || '',
    kickoffIso,
    kickoffLabel: selection.kickoffLabel || formatDateTimeLabel(kickoffIso),
    marketId: selection.marketId || 'winner',
    marketName: selection.marketName || 'Winner',
    selectionId: selection.selectionId || `WINNER_${index + 1}`,
    selectionLabel: selection.selectionLabel || 'Winning selection',
    odds: String(selection.odds),
    probability: selection.probability || 0.5,
    homeScore: selection.finalScore ? String(selection.finalScore.home) : '',
    awayScore: selection.finalScore ? String(selection.finalScore.away) : '',
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

export function AdminWinnerForm({
  users,
  sources: initialSources,
}: {
  users: WinnerUserOption[]
  sources: ActiveWinnerSources
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayDateValue)
  const [stake, setStake] = useState('1000')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<SelectionDraft[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WinnerResponse | null>(null)
  const [copiedShareUrl, setCopiedShareUrl] = useState(false)
  const [sourceKey, setSourceKey] = useState('MANUAL')
  const [sourceSlipId, setSourceSlipId] = useState<string | null>(null)
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [manualMarketId, setManualMarketId] = useState<string>('1x2')
  const [manualSelectionId, setManualSelectionId] = useState<string>('HOME')
  const [manualOdds, setManualOdds] = useState('1.85')
  const [manualKickoff, setManualKickoff] = useState(todayDateValue)
  const [randomLeague, setRandomLeague] = useState('ANY')
  const [randomCount, setRandomCount] = useState('5')
  const [randomKickoff, setRandomKickoff] = useState(todayDateValue)

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
  const sources = initialSources
  const selectedSlip = sources.slips.find(source => `SLIP:${source.id}` === sourceKey) ?? null
  const selectedTicket = sources.tickets.find(source => `TICKET:${source.id}` === sourceKey) ?? null
  const manualMarket = findAdminMarketOption(manualMarketId) ?? ADMIN_MARKET_OPTIONS[0]
  const manualSelection =
    manualMarket.options.find(option => option.id === manualSelectionId) ?? manualMarket.options[0]

  function loadSelectedSource() {
    setError(null)
    setResult(null)
    if (selectedSlip) {
      setRows(selectedSlip.selections.map(selectionToDraft))
      setStake(String(selectedSlip.stakeMinor))
      setTitle(selectedSlip.title ?? '')
      setSourceSlipId(selectedSlip.id)
      return
    }
    if (selectedTicket) {
      setRows(selectedTicket.selections.map(selectionToDraft))
      setStake(String(selectedTicket.stakeMinor))
      setTitle(selectedTicket.slipCode ? `Winner · ${selectedTicket.slipCode}` : '')
      setSourceSlipId(null)
      if (selectedTicket.userId && users.some(user => user.id === selectedTicket.userId)) {
        setUserId(selectedTicket.userId)
        setQuery('')
      }
      return
    }
    setError('Choose an active slip or ticket to load.')
  }

  function applyWinnerPayload(payload: WinnerResponse): void {
    if (!payload.winner) {
      setError(payload.error ?? 'Could not create the winner slip.')
      return
    }
    setResult(payload)
    setCopiedShareUrl(false)
    router.refresh()
  }

  async function copyShareUrl() {
    if (!result?.shareUrl) return
    try {
      await navigator.clipboard.writeText(new URL(result.shareUrl, window.location.origin).toString())
      setCopiedShareUrl(true)
    } catch {
      setCopiedShareUrl(false)
    }
  }

  async function createFromTicket() {
    if (pending || !selectedTicket) return
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/admin/winners/from-ticket', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          title: title.trim() || undefined,
          date: date ? new Date(`${date}T12:00:00.000Z`).toISOString() : undefined,
          note: note.trim() || undefined,
        }),
      })
      applyWinnerPayload((await response.json().catch(() => ({}))) as WinnerResponse)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function addManualTeam() {
    setError(null)
    setResult(null)
    const home = homeTeam.trim()
    const away = awayTeam.trim()
    if (!home || !away) {
      setError('Enter both team names before adding a selection.')
      return
    }
    if (rows.length >= MAX_SELECTIONS) {
      setError(`A winner slip can hold at most ${MAX_SELECTIONS} selections.`)
      return
    }
    const kickoffIso = manualKickoff
      ? new Date(`${manualKickoff}T12:00:00.000Z`).toISOString()
      : new Date().toISOString()
    const enteredOdds = Number(manualOdds)
    const odds =
      Number.isFinite(enteredOdds) && enteredOdds >= MIN_ODDS && enteredOdds <= MAX_ODDS
        ? manualOdds
        : manualSelection.odds
    setRows(current => [
      ...current,
      {
        fixtureId: editableFixtureId('winner-manual', home, away, current.length),
        fixtureLabel: `${home} vs ${away}`,
        competition: 'Manually added teams',
        kickoffIso,
        kickoffLabel: formatDateTimeLabel(kickoffIso),
        marketId: manualMarket.id,
        marketName: manualMarket.name,
        selectionId: manualSelection.id,
        selectionLabel: manualSelection.label,
        odds,
        probability: manualSelection.probability,
        homeScore: '',
        awayScore: '',
      },
    ])
    setHomeTeam('')
    setAwayTeam('')
  }

  function addBlankSelection() {
    setError(null)
    setResult(null)
    if (rows.length >= MAX_SELECTIONS) {
      setError(`A winner slip can hold at most ${MAX_SELECTIONS} selections.`)
      return
    }
    const kickoffIso = fromDateTimeInputValue('', 30)
    setRows(current => [
      ...current,
      {
        fixtureId: editableFixtureId('winner-custom', 'Home team', 'Away team', current.length),
        fixtureLabel: 'Home team vs Away team',
        competition: 'Custom fixture',
        kickoffIso,
        kickoffLabel: formatDateTimeLabel(kickoffIso),
        marketId: ADMIN_MARKET_OPTIONS[0].id,
        marketName: ADMIN_MARKET_OPTIONS[0].name,
        selectionId: ADMIN_MARKET_OPTIONS[0].options[0].id,
        selectionLabel: ADMIN_MARKET_OPTIONS[0].options[0].label,
        odds: ADMIN_MARKET_OPTIONS[0].options[0].odds,
        probability: ADMIN_MARKET_OPTIONS[0].options[0].probability,
        homeScore: '',
        awayScore: '',
      },
    ])
  }

  function generateRandomTeams() {
    setError(null)
    setResult(null)
    const count = Number(randomCount)
    if (!Number.isInteger(count) || count < 1 || count > MAX_SELECTIONS) {
      setError(`Choose between 1 and ${MAX_SELECTIONS} random selections.`)
      return
    }
    const kickoffIso = randomKickoff
      ? new Date(`${randomKickoff}T12:00:00.000Z`).toISOString()
      : new Date(Date.now() + 3_600_000).toISOString()
    const drafts = buildRandomSelections({
      count,
      kickoffIso,
      leagueName: randomLeague,
      prefix: `winner-random-${Date.now()}`,
    })
    if (drafts.length === 0) {
      setError('No teams are available for that league.')
      return
    }
    setRows(drafts.map(draft => selectionToDraft(draft as unknown as TicketSelection, 0)))
  }

  function updateRow(index: number, patch: Partial<SelectionDraft>) {
    setResult(null)
    setError(null)
    setRows(current =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    )
  }

  function addPick(pick: AdminRecommendationPick) {
    setResult(null)
    setError(null)
    setRows(current => {
      if (current.some(row => row.fixtureId === pick.fixtureId)) return current
      return [
        ...current,
        {
          fixtureId: pick.fixtureId,
          fixtureLabel: pick.fixtureLabel,
          competition: pick.competition,
          kickoffIso: pick.kickoffIso,
          kickoffLabel: pick.kickoffLabel,
          marketId: pick.marketId,
          marketName: pick.marketName,
          selectionId: pick.selectionId,
          selectionLabel: pick.selectionLabel,
          odds: pick.odds.toFixed(2),
          probability: pick.probability ?? 0.5,
          homeScore: '',
          awayScore: '',
        },
      ]
    })
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
    const payoutDate = date ? new Date(`${date}T12:00:00.000Z`) : null
    if (!payoutDate || Number.isNaN(payoutDate.getTime())) {
      setError('Choose the date for this winner payout.')
      return
    }
    if (!Number.isInteger(stakeMinor) || stakeMinor < 500 || stakeMinor > 500_000) {
      setError('Stake must be a whole amount between 500 and 500,000 TZS.')
      return
    }
    if (rows.length === 0) {
      setError('Choose at least one winning selection from the fixture API.')
      return
    }
    for (const [index, row] of rows.entries()) {
      if (!row.fixtureId || !row.marketId || !row.selectionId) {
        setError(`Selection ${index + 1}: choose a fixture and selection from the API picker.`)
        return
      }
      if (!row.fixtureLabel.trim() || !row.marketName.trim() || !row.selectionLabel.trim()) {
        setError(`Selection ${index + 1}: the selected fixture details are incomplete.`)
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
          date: payoutDate.toISOString(),
          stakeMinor,
          note: note.trim() || undefined,
          sourceSlipId: sourceSlipId ?? undefined,
          selections: rows.map(row => ({
            fixtureId: row.fixtureId,
            fixtureLabel: row.fixtureLabel.trim(),
            competition: row.competition.trim() || undefined,
            marketId: row.marketId,
            marketName: row.marketName.trim(),
            selectionId: row.selectionId,
            selectionLabel: row.selectionLabel.trim(),
            kickoffIso: row.kickoffIso,
            odds: normalizeOdds(row.odds),
            finalScore: scoreFor(row),
          })),
        }),
      })
      applyWinnerPayload((await response.json().catch(() => ({}))) as WinnerResponse)
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
            Pick a registered user, choose the teams and winning selections from the live fixture
            API, set the payout date and stake, then credit the wallet after VAT.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            <Database className="h-3 w-3" />
            Fixture API | {VAT_PERCENT}% VAT deducted automatically
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-accent/25 bg-accent/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Layers3 className="h-3.5 w-3.5" />
            Active betslips
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-semibold text-main-text hover:border-accent/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={sourceKey}
            onChange={event => {
              setSourceKey(event.target.value)
              setSourceSlipId(null)
              setResult(null)
              setError(null)
            }}
            className="w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-main-text outline-none focus:border-accent/60"
          >
            <option value="MANUAL">Manual / fixture API selections</option>
            <optgroup label="Active admin slips">
              {sources.slips.map(source => (
                <option key={source.id} value={`SLIP:${source.id}`}>
                  {source.code}
                  {source.title ? ` - ${source.title}` : ''} ·{' '}
                  {source.inPlay ? `live ${source.matchLabel ?? ''}` : source.status} ·{' '}
                  {source.selectionCount} selections
                </option>
              ))}
            </optgroup>
            <optgroup label="Open tickets">
              {sources.tickets.map(source => (
                <option key={source.id} value={`TICKET:${source.id}`}>
                  {source.code} · {source.userName || source.userEmail} ·{' '}
                  {source.selections.length} selections
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={loadSelectedSource}
            disabled={sourceKey === 'MANUAL' || pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-bold text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Database className="h-3.5 w-3.5" />
            Load selections
          </button>
          {selectedSlip && sourceSlipId === selectedSlip.id ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              Assign shared slip as winner
            </button>
          ) : null}
          {selectedTicket ? (
            <button
              type="button"
              onClick={() => void createFromTicket()}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              Settle ticket as winner
            </button>
          ) : (
            <span className="hidden text-[10px] text-muted-text sm:block">
              {sources.slips.length} slips · {sources.tickets.length} tickets
            </span>
          )}
        </div>
        {selectedSlip ? (
          <p className="mt-2 text-[10px] text-muted-text">
            {selectedSlip.code} · stake {formatTzs(selectedSlip.stakeMinor)} ·{' '}
            {selectedSlip.inPlay ? `in play ${selectedSlip.matchLabel ?? ''}` : 'pre-match'} ·{' '}
            {selectedSlip.entryCount} paid entries
          </p>
        ) : null}
        {selectedTicket ? (
          <p className="mt-2 text-[10px] text-muted-text">
            {selectedTicket.code} · {selectedTicket.userName || selectedTicket.userEmail} · stake{' '}
            {formatTzs(selectedTicket.stakeMinor)} · possible{' '}
            {formatTzs(selectedTicket.potentialReturnMinor)}
            {selectedTicket.slipCode ? ` · from slip ${selectedTicket.slipCode}` : ''}
          </p>
        ) : null}
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

          <div className="grid gap-3 sm:grid-cols-3">
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
              <span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-text">
                <CalendarDays className="h-3.5 w-3.5 text-accent" />
                Payout date
              </span>
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
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
              <dt className="text-muted-text">Payout date</dt>
              <dd className="font-semibold tabular-nums text-main-text">{date || '-'}</dd>
            </div>
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

        <div className="mt-3 grid gap-3 rounded-xl border border-border bg-surface/50 p-3 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
              <Plus className="h-3.5 w-3.5 text-accent" />
              Add teams manually
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={homeTeam}
                onChange={event => setHomeTeam(event.target.value)}
                placeholder="Home team"
                maxLength={80}
                className="rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
              />
              <input
                type="text"
                value={awayTeam}
                onChange={event => setAwayTeam(event.target.value)}
                placeholder="Away team"
                maxLength={80}
                className="rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={manualMarketId}
                onChange={event => {
                  const market = findAdminMarketOption(event.target.value) ?? ADMIN_MARKET_OPTIONS[0]
                  setManualMarketId(market.id)
                  setManualSelectionId(market.options[0].id)
                  setManualOdds(market.options[0].odds)
                }}
                className="rounded-lg border border-border bg-background/60 px-2 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
              >
                {ADMIN_MARKET_OPTIONS.map(market => (
                  <option key={market.id} value={market.id}>
                    {market.name}
                  </option>
                ))}
              </select>
              <select
                value={manualSelectionId}
                onChange={event => {
                  setManualSelectionId(event.target.value)
                  const option = manualMarket.options.find(item => item.id === event.target.value)
                  if (option) setManualOdds(option.odds)
                }}
                className="rounded-lg border border-border bg-background/60 px-2 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
              >
                {manualMarket.options.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min={MIN_ODDS}
                max={MAX_ODDS}
                step={0.01}
                value={manualOdds}
                onChange={event => setManualOdds(event.target.value)}
                aria-label="Manual odds"
                className="rounded-lg border border-border bg-background/60 px-2 py-2 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
              />
              <button
                type="button"
                onClick={addManualTeam}
                className="rounded-lg border border-accent/40 bg-accent/10 px-2 py-2 text-[11px] font-bold text-accent hover:bg-accent/15"
              >
                Add selection
              </button>
            </div>
            <input
              type="date"
              value={manualKickoff}
              onChange={event => setManualKickoff(event.target.value)}
              aria-label="Manual kickoff date"
              className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-accent/60"
            />
          </div>

          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              <Dices className="h-3.5 w-3.5" />
              Load random team list
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <select
                value={randomLeague}
                onChange={event => setRandomLeague(event.target.value)}
                aria-label="Random team league"
                className="rounded-lg border border-border bg-background/60 px-2 py-2 text-[11px] text-main-text outline-none focus:border-emerald-400/60"
              >
                <option value="ANY">Any league</option>
                {RANDOM_TEAM_GROUPS.map(group => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                value={randomCount}
                onChange={event => setRandomCount(event.target.value)}
                aria-label="Random selection count"
                className="rounded-lg border border-border bg-background/60 px-2 py-2 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-emerald-400/60"
              >
                {Array.from({ length: MAX_SELECTIONS }, (_, index) => index + 1).map(value => (
                  <option key={value} value={value}>
                    {value} matches
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={generateRandomTeams}
                className="rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                Generate
              </button>
            </div>
            <input
              type="date"
              value={randomKickoff}
              onChange={event => setRandomKickoff(event.target.value)}
              aria-label="Random kickoff date"
              className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-emerald-400/60"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addBlankSelection}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold text-accent hover:bg-accent/15"
              >
                <Plus className="h-3 w-3" />
                Add selection
              </button>
              <button
                type="button"
                onClick={() => {
                  setRows([])
                  setResult(null)
                  setError(null)
                }}
                disabled={rows.length === 0}
                className="text-[10px] font-semibold text-muted-text underline underline-offset-2 hover:text-main-text disabled:opacity-50"
              >
                Clear all selections
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] leading-relaxed text-muted-text">
              No winning selections yet. Load an active slip or ticket, add teams manually,
              generate a random list, or use the fixture API picker below.
            </p>
          ) : null}

          {rows.map((row, index) => (
            <div
              key={`winner-selection-${index}`}
              className="rounded-xl border border-border bg-surface/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Selection {index + 1}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-main-text">
                    {row.fixtureLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-text">
                    {row.competition} | {row.kickoffLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove selection ${index + 1}`}
                  className="rounded-lg border border-border bg-surface p-1.5 text-muted-text transition-colors hover:border-red-400/40 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <AdminEditableSelectionFields
                value={row}
                index={index}
                onChange={patch => updateRow(index, patch)}
              />

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
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

        <AdminSelectionPicker
          excludedFixtures={new Set(rows.map(row => row.fixtureId))}
          onAdd={addPick}
          disabled={pending}
          statuses={WINNER_STATUSES}
          actionLabel="Choose winning selection"
          emptyLabel="No fixtures match that search."
          limit={500}
        />
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
            VAT ({VAT_PERCENT}%).
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
          {result.shareUrl ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/25 bg-background/40 px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-text">
                Share link <span className="font-mono text-amber-200">{result.shareUrl}</span>
              </span>
              <button
                type="button"
                onClick={() => void copyShareUrl()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-300/20"
              >
                {copiedShareUrl ? <CircleCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedShareUrl ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-text">
              The user can now see the payout in their wallet and withdraw it.
            </span>
            <Link
              href={result.shareUrl ?? `/bet/winner/${result.winner.code}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[10px] font-bold text-main-text hover:border-amber-300/40"
            >
              Open receipt
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}
