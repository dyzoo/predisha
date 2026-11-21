'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleCheck,
  Clock,
  Copy,
  Download,
  Layers,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import type { SlipDesignStatus, SlipDesignView } from '@/lib/bet/slip-designs'
import {
  blankSelection,
  calculateTotals,
  splitFixtureLabel,
  toDesignInput,
  toEditorSelection,
  type EditorSelection,
  type FixtureMarketOption,
  type FixtureOption,
  type FixturePickOption,
  type SharedSlipOption,
} from './model'
import { SlipPreview, type SlipPreviewTheme } from './slip-preview'

interface BetSlipStudioProps {
  fixtures: FixtureOption[]
  sharedSlips: SharedSlipOption[]
  savedSlips: SlipDesignView[]
}

interface Notice {
  tone: 'ok' | 'error'
  text: string
}

function statusTone(status: SlipDesignStatus) {
  if (status === 'WON') return 'border-amber-300/40 bg-amber-300/10 text-amber-200'
  if (status === 'READY') return 'border-accent/40 bg-accent/10 text-accent'
  return 'border-border bg-background/40 text-muted-text'
}

export function BetSlipStudio({ fixtures, sharedSlips, savedSlips }: BetSlipStudioProps) {
  const router = useRouter()
  const previewRef = useRef<HTMLDivElement>(null)

  const [saved, setSaved] = useState(savedSlips)
  const [designId, setDesignId] = useState<string | null>(null)
  const [designCode, setDesignCode] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<SlipDesignStatus>('DRAFT')
  const [stakeInput, setStakeInput] = useState('500')
  const [bonusInput, setBonusInput] = useState('0')
  const [taxInput, setTaxInput] = useState('15')
  const [reuseCount, setReuseCount] = useState(1)
  const [slipTheme, setSlipTheme] = useState<SlipPreviewTheme>('black')
  const [betId, setBetId] = useState('BET #8720195380')
  const [placedAt, setPlacedAt] = useState('Sun 25/05 at 9:15 am')
  const [selections, setSelections] = useState<EditorSelection[]>([blankSelection()])

  const [sourceTab, setSourceTab] = useState<'fixtures' | 'shared' | 'manual'>('fixtures')
  const [fixtureQuery, setFixtureQuery] = useState('')
  const [sharedQuery, setSharedQuery] = useState('')
  const [savedQuery, setSavedQuery] = useState('')
  const [expandedFixture, setExpandedFixture] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const stakeMinor = Math.max(0, Number(stakeInput) || 0)
  const bonusMinor = Math.max(0, Number(bonusInput) || 0)
  const taxPercent = Math.min(50, Math.max(0, Number(taxInput) || 0))
  const totals = useMemo(
    () => calculateTotals(selections, stakeMinor, bonusMinor, taxPercent),
    [selections, stakeMinor, bonusMinor, taxPercent],
  )

  const filteredFixtures = useMemo(() => {
    const query = fixtureQuery.trim().toLowerCase()
    const list = query
      ? fixtures.filter(fixture =>
          `${fixture.label} ${fixture.competition} ${fixture.status}`.toLowerCase().includes(query),
        )
      : fixtures
    return list.slice(0, 80)
  }, [fixtures, fixtureQuery])

  const filteredShared = useMemo(() => {
    const query = sharedQuery.trim().toLowerCase()
    return sharedSlips.filter(slip =>
      `${slip.code} ${slip.title ?? ''} ${slip.status}`.toLowerCase().includes(query),
    )
  }, [sharedSlips, sharedQuery])

  const filteredSaved = useMemo(() => {
    const query = savedQuery.trim().toLowerCase()
    return saved.filter(slip =>
      `${slip.code} ${slip.title ?? ''} ${slip.status}`.toLowerCase().includes(query),
    )
  }, [saved, savedQuery])

  function updateSelection(id: string, patch: Partial<EditorSelection>) {
    setSelections(current => current.map(selection => (selection.id === id ? { ...selection, ...patch } : selection)))
  }

  function moveSelection(index: number, delta: number) {
    setSelections(current => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function addPick(fixture: FixtureOption, market: FixtureMarketOption, pick: FixturePickOption) {
    const id = `${fixture.id}:${market.id}:${pick.selectionId}`
    if (selections.some(selection => selection.id === id)) {
      setNotice({ tone: 'error', text: 'That selection is already in the slip.' })
      return
    }
    setSelections(current => [
      ...current,
      {
        id,
        time: fixture.kickoffLabel,
        odds: pick.odds.toFixed(2),
        home: fixture.home,
        away: fixture.away,
        league: fixture.competition,
        selection: `${market.name} - ${pick.label}`,
        won: false,
        fixtureId: fixture.id,
        finalScore: '',
      },
    ])
    setNotice({ tone: 'ok', text: 'Fixture pick added to the slip.' })
  }

  function loadSharedSlip(slip: SharedSlipOption) {
    const loaded = slip.selections.map((selection, index) => {
      const teams = splitFixtureLabel(selection.fixtureLabel)
      return {
        id: `shared-${slip.code}-${index}`,
        time: selection.kickoffLabel ?? '',
        odds: selection.odds.toFixed(2),
        home: teams.home,
        away: teams.away,
        league: selection.competition ?? '',
        selection: `${selection.marketName} - ${selection.selectionLabel}`,
        won: false,
        fixtureId: null,
        finalScore: '',
      }
    })
    if (loaded.length === 0) {
      setNotice({ tone: 'error', text: 'That shared slip has no selections to load.' })
      return
    }
    setSelections(loaded)
    setStakeInput(String(slip.stakeMinor))
    setTitle(current => current || slip.title || `Slip ${slip.code}`)
    setStatus('DRAFT')
    setNotice({ tone: 'ok', text: `Loaded ${loaded.length} picks from shared slip ${slip.code}.` })
  }

  function loadSavedSlipAsWinner(slip: SlipDesignView) {
    setDesignId(slip.id)
    setDesignCode(slip.code)
    setTitle(slip.title ?? '')
    setStatus('WON')
    setStakeInput(String(slip.stakeMinor))
    setBonusInput(String(slip.bonusMinor))
    setTaxInput(String(slip.taxPercent))
    setReuseCount(slip.reuseCount)
    setSelections(slip.selections.map(toEditorSelection))
    setNotice({ tone: 'ok', text: `Loaded ${slip.selections.length} picks from ${slip.code} as a winner slip.` })
  }

  function loadSharedSlipAsWinner(slip: SharedSlipOption) {
    const loaded = slip.selections.map((selection, index) => {
      const teams = splitFixtureLabel(selection.fixtureLabel)
      return {
        id: `shared-winner-${slip.code}-${index}`,
        time: selection.kickoffLabel ?? '',
        odds: selection.odds.toFixed(2),
        home: teams.home,
        away: teams.away,
        league: selection.competition ?? '',
        selection: `${selection.marketName} - ${selection.selectionLabel}`,
        won: true,
        fixtureId: null,
        finalScore: '',
      }
    })
    setSelections(loaded)
    setStakeInput(String(slip.stakeMinor))
    setTitle(current => current || slip.title || `Slip ${slip.code}`)
    setStatus('WON')
    setNotice({ tone: 'ok', text: `Loaded ${loaded.length} picks from shared slip ${slip.code} as a winner slip.` })
  }

  function applyDesign(slip: SlipDesignView) {
    setDesignId(slip.id)
    setDesignCode(slip.code)
    setTitle(slip.title ?? '')
    setStatus(slip.status)
    setStakeInput(String(slip.stakeMinor))
    setBonusInput(String(slip.bonusMinor))
    setTaxInput(String(slip.taxPercent))
    setReuseCount(slip.reuseCount)
    setSelections(slip.selections.map(toEditorSelection))
  }

  function resetEditor() {
    setDesignId(null)
    setDesignCode(null)
    setTitle('')
    setStatus('DRAFT')
    setStakeInput('500')
    setBonusInput('0')
    setTaxInput('15')
    setReuseCount(1)
    setSelections([blankSelection()])
    setNotice(null)
  }

  function upsertSaved(slip: SlipDesignView) {
    setSaved(current => {
      const exists = current.some(item => item.id === slip.id)
      return exists ? current.map(item => (item.id === slip.id ? slip : item)) : [slip, ...current]
    })
  }

  function validate(): string | null {
    if (!title.trim()) return 'Give the slip a title before saving.'
    if (selections.length === 0) return 'Add at least one selection.'
    for (const [index, selection] of selections.entries()) {
      if (!selection.home.trim() || !selection.away.trim() || !selection.selection.trim()) {
        return `Complete every field on selection ${index + 1}.`
      }
      const odds = Number(selection.odds)
      if (!Number.isFinite(odds) || odds < 1.01 || odds > 1000) {
        return `Odds on selection ${index + 1} must be between 1.01 and 1000.`
      }
    }
    return null
  }

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Request failed. Try again.')
    return payload
  }

  async function saveSlip() {
    const validationError = validate()
    if (validationError) {
      setNotice({ tone: 'error', text: validationError })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const input = toDesignInput({ title, status, stakeMinor, bonusMinor, taxPercent, reuseCount, selections })
      const payload = designId
        ? await requestJson<{ slip: SlipDesignView }>(`/api/admin/slip-designs/${designId}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
          })
        : await requestJson<{ slip: SlipDesignView }>('/api/admin/slip-designs', {
            method: 'POST',
            body: JSON.stringify(input),
          })
      applyDesign(payload.slip)
      upsertSaved(payload.slip)
      setNotice({
        tone: 'ok',
        text: `${designId ? 'Updated' : 'Saved'} ${payload.slip.code}${payload.slip.status === 'WON' ? ' with winning ticks.' : '.'}`,
      })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save the slip.' })
    } finally {
      setBusy(false)
    }
  }

  async function runAction(id: string, action: 'mark-won' | 'mark-ready' | 'duplicate') {
    setBusy(true)
    setNotice(null)
    try {
      const payload = await requestJson<{ slip: SlipDesignView }>(`/api/admin/slip-designs/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      upsertSaved(payload.slip)
      if (designId === id || action === 'duplicate') applyDesign(payload.slip)
      const message =
        action === 'mark-won'
          ? `Marked ${payload.slip.code} as won - ticks added to every selection.`
          : action === 'mark-ready'
            ? `Cleared winning ticks on ${payload.slip.code}.`
            : `Duplicated slip as ${payload.slip.code}.`
      setNotice({ tone: 'ok', text: message })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not update the slip.' })
    } finally {
      setBusy(false)
    }
  }

  async function removeSlip(id: string) {
    setBusy(true)
    setNotice(null)
    try {
      const payload = await requestJson<{ deleted: string }>(`/api/admin/slip-designs/${id}`, {
        method: 'DELETE',
      })
      setSaved(current => current.filter(slip => slip.id !== id))
      if (designId === id) resetEditor()
      setConfirmDelete(null)
      setNotice({ tone: 'ok', text: `Deleted ${payload.deleted}.` })
      router.refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not delete the slip.' })
    } finally {
      setBusy(false)
    }
  }

  function markAllWon(won: boolean) {
    setSelections(current => current.map(selection => ({ ...selection, won })))
    setStatus(won ? 'WON' : 'READY')
    setNotice({
      tone: 'ok',
      text: won ? 'Marked as won. Save to keep the winner slip.' : 'Cleared the winner slip.',
    })
  }

  async function downloadSlip() {
    if (!previewRef.current) return
    setDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: 2,
        backgroundColor: slipTheme === 'black' ? '#101318' : '#FFFFFF',
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `betslip-${designCode ?? 'draft'}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setNotice({ tone: 'ok', text: 'Bet slip image downloaded.' })
    } catch (error) {
      console.error('Bet slip image export failed', error)
      setNotice({ tone: 'error', text: 'Download failed. Please try again.' })
    } finally {
      setDownloading(false)
    }
  }

  async function shareSlip() {
    const text = `Odds ${formatOdds(totals.totalOdds)}x | Stake ${formatTzs(stakeMinor)} | ${
      status === 'WON' ? 'Paid' : 'Potential payout'
    } ${formatTzs(totals.payoutMinor)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Bet slip', text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setNotice({ tone: 'ok', text: 'Slip summary copied to clipboard.' })
      } else {
        setNotice({ tone: 'ok', text })
      }
    } catch {
      setNotice({ tone: 'error', text: 'Share cancelled.' })
    }
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
            notice.tone === 'ok'
              ? 'border-accent/25 bg-accent/10 text-accent'
              : 'border-red-400/25 bg-red-400/10 text-red-200'
          }`}
        >
          {notice.tone === 'ok' ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
                  <Layers className="h-4 w-4 text-accent" />
                  Saved slips
                </h2>
                <p className="mt-2 text-[11px] text-muted-text">
                  Reopen anything you created, duplicate it, mark it won or delete it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetEditor()
                  setNotice({ tone: 'ok', text: 'New slip started.' })
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs font-semibold text-main-text transition-colors hover:border-accent/40"
              >
                <Plus className="h-3.5 w-3.5 text-accent" />
                New slip
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                value={savedQuery}
                onChange={event => setSavedQuery(event.target.value)}
                placeholder="Find a saved slip by title, code or status"
                className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
              />
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredSaved.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-text">
                  No saved slips yet. Build one below and save it.
                </p>
              ) : null}
              {filteredSaved.map(slip => (
                <div
                  key={slip.id}
                  className={`rounded-xl border p-3 ${
                    designId === slip.id ? 'border-accent/50 bg-accent/5' : 'border-border bg-background/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-main-text">
                        {slip.title ?? 'Untitled bet slip'}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-muted-text">
                        {slip.code} · {slip.selections.length} picks · {formatOdds(slip.totalOdds)}x
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-text">
                        {formatDateTimeLabel(slip.updatedAt)} · {formatTzs(slip.payoutMinor)} payout
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(slip.status)}`}>
                      {slip.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" disabled={busy} onClick={() => applyDesign(slip)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text hover:border-accent/40 disabled:opacity-60">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button type="button" disabled={busy} onClick={() => runAction(slip.id, 'duplicate')} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text hover:border-accent/40 disabled:opacity-60">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <button type="button" disabled={busy} onClick={() => loadSavedSlipAsWinner(slip)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 disabled:opacity-60">
                      <Trophy className="h-3 w-3" /> Winner
                    </button>
                    <button type="button" disabled={busy} onClick={() => runAction(slip.id, 'mark-won')} className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 disabled:opacity-60">
                      <Trophy className="h-3 w-3" /> Won
                    </button>
                    {slip.status === 'WON' ? (
                      <button type="button" disabled={busy} onClick={() => runAction(slip.id, 'mark-ready')} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text hover:border-accent/40 disabled:opacity-60">
                        <RotateCcw className="h-3 w-3" /> Clear ticks
                      </button>
                    ) : null}
                    {confirmDelete === slip.id ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => removeSlip(slip.id)} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-background disabled:opacity-60">
                          Confirm delete
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(slip.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-400/25 bg-red-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
              <ListChecks className="h-4 w-4 text-accent" />
              Load selections
            </h2>
            <p className="mt-2 text-[11px] text-muted-text">
              Pull picks from system fixtures or an active shared slip, or build rows by hand.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {([
                { key: 'fixtures', label: 'System fixtures' },
                { key: 'shared', label: 'Active shared slips' },
                { key: 'manual', label: 'Manual rows' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSourceTab(tab.key)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    sourceTab === tab.key
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border bg-background/40 text-muted-text hover:text-main-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {sourceTab === 'fixtures' ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
                  <Search className="h-3.5 w-3.5 text-muted-text" />
                  <input
                    value={fixtureQuery}
                    onChange={event => setFixtureQuery(event.target.value)}
                    placeholder="Search teams or competitions"
                    className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
                  />
                </div>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {filteredFixtures.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-text">
                      No fixtures matched. Sync fixtures from the admin overview first.
                    </p>
                  ) : null}
                  {filteredFixtures.map(fixture => (
                    <div key={fixture.id} className="rounded-xl border border-border bg-background/40">
                      <button
                        type="button"
                        onClick={() => setExpandedFixture(current => (current === fixture.id ? null : fixture.id))}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-main-text">{fixture.label}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-text">
                            {fixture.competition} · {fixture.kickoffLabel} · {fixture.status}
                          </p>
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-text transition-transform ${expandedFixture === fixture.id ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedFixture === fixture.id ? (
                        <div className="space-y-3 border-t border-border px-3 py-3">
                          {fixture.markets.length === 0 ? (
                            <p className="text-[11px] text-muted-text">No markets available for this fixture.</p>
                          ) : null}
                          {fixture.markets.map(market => (
                            <div key={market.id}>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                                {market.name}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {market.picks.map(pick => (
                                  <button
                                    key={`${market.id}:${pick.selectionId}`}
                                    type="button"
                                    onClick={() => addPick(fixture, market, pick)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/50"
                                  >
                                    {pick.label}
                                    <span className="font-mono text-accent">{formatOdds(pick.odds)}</span>
                                    <Plus className="h-3 w-3 text-muted-text" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {sourceTab === 'shared' ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
                  <Search className="h-3.5 w-3.5 text-muted-text" />
                  <input
                    value={sharedQuery}
                    onChange={event => setSharedQuery(event.target.value)}
                    placeholder="Find a shared slip by code or title"
                    className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
                  />
                </div>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {filteredShared.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-text">
                      No active shared slips available right now.
                    </p>
                  ) : null}
                  {filteredShared.map(slip => (
                    <div key={slip.id} className="rounded-xl border border-border bg-background/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-main-text">
                            {slip.title ?? 'Shared slip'}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-muted-text">
                            {slip.code} · {slip.selectionCount} picks · {formatOdds(slip.totalOdds)}x
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-text">Stake {formatTzs(slip.stakeMinor)}</p>
                        </div>
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                          {slip.status}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-semibold text-muted-text">
                          View picks
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {slip.selections.map((selection, index) => (
                            <li key={`${slip.code}-${index}`} className="text-[11px] text-main-text">
                              {selection.fixtureLabel} · {selection.marketName} · {selection.selectionLabel}{' '}
                              <span className="font-mono text-accent">{formatOdds(selection.odds)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      <button
                        type="button"
                        onClick={() => loadSharedSlip(slip)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90"
                      >
                        <Plus className="h-3 w-3" /> Load picks into slip
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSharedSlipAsWinner(slip)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-opacity hover:opacity-90"
                      >
                        <Trophy className="h-3 w-3" /> Use as winner
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {sourceTab === 'manual' ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-background/40 p-4">
                <p className="text-xs text-muted-text">Add empty rows and fill in teams, market and odds yourself.</p>
                <button
                  type="button"
                  onClick={() => setSelections(current => [...current, blankSelection()])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-main-text hover:border-accent/40"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" /> Add row
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-base font-bold text-main-text">Slip details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Slip title</span>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="e.g. Saturday accumulator"
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Bet ID</span>
                <input
                  value={betId}
                  onChange={event => setBetId(event.target.value)}
                  placeholder="e.g. BET #8720195380"
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Bet placed</span>
                <input
                  value={placedAt}
                  onChange={event => setPlacedAt(event.target.value)}
                  placeholder="e.g. Sun 25/05 at 9:15 am"
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Stake (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={stakeInput}
                  onChange={event => setStakeInput(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none focus:border-accent/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Win bonus (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={bonusInput}
                  onChange={event => setBonusInput(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none focus:border-accent/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Withholding tax (%)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={taxInput}
                  onChange={event => setTaxInput(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none focus:border-accent/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Re-use count</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={reuseCount}
                  onChange={event => setReuseCount(Number(event.target.value) || 1)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none focus:border-accent/60"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-main-text">
                Selections <span className="text-muted-text">({selections.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setSelections(current => [...current, blankSelection()])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs font-semibold text-main-text hover:border-accent/40"
              >
                <Plus className="h-3.5 w-3.5 text-accent" /> Add row
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selections.map((selection, index) => (
                <div key={selection.id} className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                      Selection {index + 1}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <button type="button" onClick={() => moveSelection(index, -1)} aria-label="Move selection up" className="rounded-lg border border-border bg-surface p-1.5 text-muted-text hover:text-main-text">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => moveSelection(index, 1)} aria-label="Move selection down" className="rounded-lg border border-border bg-surface p-1.5 text-muted-text hover:text-main-text">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setSelections(current => current.filter(row => row.id !== selection.id))} aria-label="Remove selection" className="rounded-lg border border-red-400/25 bg-red-400/10 p-1.5 text-red-200">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">Home</span>
                      <input value={selection.home} onChange={event => updateSelection(selection.id, { home: event.target.value })} placeholder="Home team" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">Away</span>
                      <input value={selection.away} onChange={event => updateSelection(selection.id, { away: event.target.value })} placeholder="Away team" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">League</span>
                      <input value={selection.league} onChange={event => updateSelection(selection.id, { league: event.target.value })} placeholder="Competition" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">Time</span>
                      <input value={selection.time} onChange={event => updateSelection(selection.id, { time: event.target.value })} placeholder="Kickoff" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[10px] text-muted-text">Market / selection</span>
                      <input value={selection.selection} onChange={event => updateSelection(selection.id, { selection: event.target.value })} placeholder="e.g. 1X2 - Home win" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">Odds</span>
                      <input type="number" min={1.01} max={1000} step={0.01} value={selection.odds} onChange={event => updateSelection(selection.id, { odds: event.target.value })} className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-muted-text">Final score (optional)</span>
                      <input value={selection.finalScore} onChange={event => updateSelection(selection.id, { finalScore: event.target.value })} placeholder="e.g. 2 - 1" className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-main-text outline-none focus:border-accent/60" />
                    </label>

                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-base font-bold text-main-text">Finish the slip</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-text">
            Marking won marks the slip as won and updates the winner receipt. It only
            changes this slip image - it does not pay any customer or publish a winner.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => markAllWon(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-xs font-semibold text-amber-200 disabled:opacity-60">
                <Trophy className="h-3.5 w-3.5" /> Mark as won
              </button>
              <button type="button" disabled={busy} onClick={() => markAllWon(false)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/40 px-4 py-2.5 text-xs font-semibold text-main-text disabled:opacity-60">
                <RotateCcw className="h-3.5 w-3.5" /> Clear ticks
              </button>
              <button type="button" disabled={busy} onClick={() => { setStatus('READY'); setNotice({ tone: 'ok', text: 'Slip marked ready. Save to keep status.' }) }} className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent disabled:opacity-60">
                <ListChecks className="h-3.5 w-3.5" /> Mark ready
              </button>
              <button type="button" disabled={busy || downloading} onClick={saveSlip} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {designId ? 'Save changes' : 'Save slip'}
              </button>
              <button type="button" disabled={downloading} onClick={downloadSlip} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/40 px-4 py-2.5 text-xs font-semibold text-main-text disabled:opacity-60">
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-accent" />}
                {downloading ? 'Downloading...' : 'Download PNG'}
              </button>
            </div>
          </section>
        </div>

        <aside className="min-w-0">
          <div className="sticky top-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Live preview</p>
                <p className="mt-1 text-[11px] text-muted-text">
                  {designCode ? `Editing ${designCode}` : 'Unsaved draft'} · {formatOdds(totals.totalOdds)}x ·{' '}
                  {formatTzs(totals.payoutMinor)}
                </p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(status)}`}>
                {status}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 p-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">Theme</span>
              <button
                type="button"
                onClick={() => setSlipTheme('black')}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                  slipTheme === 'black'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border bg-background/40 text-muted-text'
                }`}
              >
                Black
              </button>
              <button
                type="button"
                onClick={() => setSlipTheme('white')}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                  slipTheme === 'white'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border bg-background/40 text-muted-text'
                }`}
              >
                White
              </button>
            </div>
            <SlipPreview
              containerRef={previewRef}
              title={title}
              code={designCode}
              status={status}
              selections={selections}
              totalOdds={totals.totalOdds}
              stakeMinor={stakeMinor}
              winningsMinor={totals.winningsMinor}
              bonusMinor={bonusMinor}
              taxPercent={taxPercent}
              taxMinor={totals.taxMinor}
              payoutMinor={totals.payoutMinor}
              reuseCount={reuseCount}
              onReuse={() => setReuseCount(current => Math.min(99, current + 1))}
              onShare={shareSlip}
              theme={slipTheme}
              betId={betId}
              placedAt={placedAt}
            />
            <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-text">
              <Clock className="h-3 w-3" /> Only the slip above is exported to PNG.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
