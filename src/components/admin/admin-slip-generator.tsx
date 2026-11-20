'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import type {
  AdminRecommendationPick,
  AdminSlipRecommendation,
} from '@/lib/bet/recommendation'
import {
  ADMIN_MARKET_OPTIONS,
  editableFixtureId,
} from '@/lib/bet/admin-selection-options'
import { formatKickoffLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import {
  buildRandomSelections,
  RANDOM_TEAM_GROUPS,
  type RandomSelectionDraft,
} from '@/lib/bet/random-teams'
import type { AdminSlipTimeMode } from '@/lib/bet/types'
import { applyVat, VAT_PERCENT } from '@/lib/bet/vat'
import {
  AdminEditableSelectionFields,
  type AdminEditableSelectionValue,
} from './admin-editable-selection-fields'
import { AdminSelectionPicker } from './admin-selection-picker'

type PickedSelection = Omit<AdminRecommendationPick, 'odds' | 'riskLevel'> & {
  odds: string
  riskLevel?: string
  custom?: boolean
}

type CreationMode = 'AI' | 'MANUAL' | 'RANDOM'

const MIN_ODDS = 1.01
const MAX_ODDS = 1000

interface CreateResponse {
  error?: string
  slip?: {
    code: string
    shareUrl?: string
    stakeMinor: number
    totalOdds: number
    potentialReturnMinor: number
    vatMinor: number
    netPayoutMinor: number
  }
  shareUrl?: string
}

function toPicked(picks: AdminRecommendationPick[]): PickedSelection[] {
  return picks.map(pick => ({ ...pick, odds: pick.odds.toFixed(2) }))
}

function staggeredKickoff(baseIso: string, index: number): string {
  const base = new Date(baseIso).getTime()
  if (Number.isNaN(base)) return baseIso
  return new Date(base + index * 15 * 60_000).toISOString()
}

function toRandomPicked(
  picks: RandomSelectionDraft[],
  staggerBase?: string,
  offset = 0,
): PickedSelection[] {
  return picks.map((pick, index) => {
    const kickoffIso = staggerBase
      ? staggeredKickoff(staggerBase, offset + index)
      : pick.kickoffIso
    return {
      ...pick,
      kickoffIso,
      kickoffLabel: formatKickoffLabel(kickoffIso),
      odds: pick.odds.toFixed(2),
      riskLevel: 'random',
    }
  })
}

function normalizeOddsValue(odds: string): number {
  const value = Number(odds)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function combinedOdds(picked: PickedSelection[]): number {
  if (picked.length === 0) return 0
  const product = picked.reduce(
    (total, item) => total * normalizeOddsValue(item.odds),
    1,
  )
  return Math.max(1, Math.round(product * 100) / 100)
}

function validOdds(odds: string): boolean {
  const value = Number(odds)
  return Number.isFinite(value) && value >= MIN_ODDS && value <= MAX_ODDS
}

function generatedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'just now'
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function kickoffIsoFromInput(value: string, fallbackMinutes = 30): string {
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return new Date(Date.now() + fallbackMinutes * 60_000).toISOString()
}

function dateTimeInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function randomPrefix(): string {
  return `random-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AdminSlipGenerator({
  recommendation,
}: {
  recommendation: AdminSlipRecommendation
}) {
  const router = useRouter()
  const [creationMode, setCreationMode] = useState<CreationMode>('AI')
  const [timeMode, setTimeMode] = useState<AdminSlipTimeMode>('ORIGINAL')
  const [manualKickoff, setManualKickoff] = useState(() =>
    dateTimeInputValue(new Date(Date.now() + 30 * 60_000).toISOString()),
  )
  const [simulatedDuration, setSimulatedDuration] = useState('90')
  const [randomLeague, setRandomLeague] = useState('ANY')
  const [randomCount, setRandomCount] = useState('8')
  const [title, setTitle] = useState('')
  const [stake, setStake] = useState('1000')
  const [picked, setPicked] = useState<PickedSelection[]>(() => toPicked(recommendation.picks))
  const [generatedAt, setGeneratedAt] = useState(recommendation.generatedAt)
  const [demo, setDemo] = useState(recommendation.demo)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const totalOdds = combinedOdds(picked)
  const stakeMinor = Number(stake)
  const potentialReturnMinor =
    Number.isFinite(stakeMinor) && stakeMinor > 0 && totalOdds > 0
      ? Math.floor(stakeMinor * totalOdds)
      : 0
  const vatPreview = applyVat(potentialReturnMinor)
  const pickedFixtures = new Set(picked.map(item => item.fixtureId))

  function clearFeedback() {
    setResult(null)
    setCopied(false)
    setError(null)
  }

  function switchMode(next: CreationMode) {
    if (next === creationMode) return
    clearFeedback()
    setCreationMode(next)
    if (next === 'MANUAL') {
      setPicked([])
      setGeneratedAt(new Date().toISOString())
      setTimeMode('ORIGINAL')
    } else if (next === 'RANDOM') {
      setTimeMode('SIMULATED')
      const iso = kickoffIsoFromInput(manualKickoff)
      setPicked(
        toRandomPicked(
          buildRandomSelections({
            count: Math.min(20, Math.max(1, Number(randomCount) || 8)),
            kickoffIso: iso,
            leagueName: randomLeague,
            prefix: randomPrefix(),
          }),
          iso,
        ),
      )
      setGeneratedAt(iso)
      setDemo(false)
    } else {
      setPicked(toPicked(recommendation.picks))
      setGeneratedAt(recommendation.generatedAt)
      setDemo(recommendation.demo)
      setTimeMode('ORIGINAL')
    }
  }

  function updateKickoff(value: string) {
    setManualKickoff(value)
    clearFeedback()
    if (creationMode !== 'RANDOM') return
    const iso = kickoffIsoFromInput(value)
    setPicked(current =>
      current.map((item, index) => {
        const kickoffIso = staggeredKickoff(iso, index)
        return {
          ...item,
          kickoffIso,
          kickoffLabel: formatKickoffLabel(kickoffIso),
        }
      }),
    )
  }

  function generateRandomPicks(append: boolean) {
    clearFeedback()
    const iso = kickoffIsoFromInput(manualKickoff)
    const count = Math.min(20, Math.max(1, Number(randomCount) || 8))
    const drafts = buildRandomSelections({
      count: append ? Math.max(1, count - picked.length) : count,
      kickoffIso: iso,
      leagueName: randomLeague,
      prefix: randomPrefix(),
    })
    const next = toRandomPicked(drafts, iso, append ? picked.length : 0)
    setPicked(current => {
      if (!append) return next
      const existing = new Set(current.map(item => item.fixtureId))
      return [...current, ...next.filter(item => !existing.has(item.fixtureId))].slice(0, 20)
    })
    setGeneratedAt(iso)
    setDemo(false)
  }

  function updateOdds(index: number, odds: string) {
    clearFeedback()
    setPicked(current =>
      current.map((item, position) => (position === index ? { ...item, odds } : item)),
    )
  }

  function updatePicked(index: number, patch: Partial<AdminEditableSelectionValue>) {
    clearFeedback()
    setPicked(current =>
      current.map((item, position) =>
        position === index
          ? {
              ...item,
              ...patch,
              kickoffLabel: patch.kickoffLabel ?? item.kickoffLabel,
              custom: true,
            }
          : item,
      ),
    )
  }

  function addBlankRandomPick() {
    clearFeedback()
    if (picked.length >= 20) return
    const kickoffIso = kickoffIsoFromInput(manualKickoff)
    const market = ADMIN_MARKET_OPTIONS[0]
    const option = market.options[0]
    setPicked(current => [
      ...current,
      {
        fixtureId: editableFixtureId('random-custom', 'Home team', 'Away team', current.length),
        fixtureLabel: 'Home team vs Away team',
        competition: 'Custom fixture',
        kickoffIso,
        kickoffLabel: formatKickoffLabel(kickoffIso),
        marketId: market.id,
        marketName: market.name,
        selectionId: option.id,
        selectionLabel: option.label,
        odds: option.odds,
        probability: option.probability,
        riskLevel: 'random',
        custom: true,
      },
    ])
  }

  function removePick(fixtureId: string) {
    clearFeedback()
    setPicked(current => current.filter(item => item.fixtureId !== fixtureId))
  }

  function addPick(pick: AdminRecommendationPick) {
    clearFeedback()
    setPicked(current => {
      if (current.some(item => item.fixtureId === pick.fixtureId)) return current
      return [...current, ...toPicked([pick])]
    })
  }

  async function refreshPicks() {
    if (refreshing || pending) return
    setRefreshing(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/admin/bets/recommendation', {
        cache: 'no-store',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as
        | AdminSlipRecommendation
        | { error?: string }
      if (!response.ok || !('picks' in payload)) {
        setError(('error' in payload && payload.error) || 'Could not refresh the model picks.')
        return
      }
      setPicked(toPicked(payload.picks))
      setGeneratedAt(payload.generatedAt)
      setDemo(payload.demo)
    } catch {
      setError('Network error while refreshing the model picks.')
    } finally {
      setRefreshing(false)
    }
  }

  async function onSubmit() {
    if (pending) return
    setError(null)
    setResult(null)
    setCopied(false)
    if (picked.length === 0) {
      setError(
        creationMode === 'MANUAL'
          ? 'Add at least one match to create a slip.'
          : 'The model has no eligible picks right now. Refresh in a moment or build a slip manually.',
      )
      return
    }
    if (timeMode !== 'ORIGINAL' && !manualKickoff) {
      setError('Choose the kickoff time before publishing this slip.')
      return
    }
    if (!Number.isInteger(stakeMinor) || stakeMinor < 500 || stakeMinor > 500_000) {
      setError('Stake must be a whole amount between 500 and 500,000 TZS.')
      return
    }
    if (picked.some(item => !validOdds(item.odds))) {
      setError(`Each odd must be between ${MIN_ODDS} and ${MAX_ODDS}.`)
      return
    }
    setPending(true)
    try {
      const response = await fetch('/api/admin/bets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() ? title.trim() : undefined,
          stakeMinor,
          timeMode,
          selectionSource: creationMode === 'RANDOM' ? 'RANDOM' : 'CATALOG',
          manualKickoffAt: manualKickoff ? kickoffIsoFromInput(manualKickoff) : undefined,
          simulatedDurationMinutes: Number(simulatedDuration) || 90,
          selections: picked.map(item =>
            item.custom
              ? {
                  fixtureId: item.fixtureId,
                  fixtureLabel: item.fixtureLabel,
                  competition: item.competition,
                  kickoffIso: item.kickoffIso,
                  marketId: item.marketId,
                  marketName: item.marketName,
                  selectionId: item.selectionId,
                  selectionLabel: item.selectionLabel,
                  odds: normalizeOddsValue(item.odds),
                  probability: item.probability,
                  custom: true,
                }
              : {
                  fixtureId: item.fixtureId,
                  marketId: item.marketId,
                  selectionId: item.selectionId,
                  odds: normalizeOddsValue(item.odds),
                },
          ),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as CreateResponse
      if (!response.ok || !payload.slip) {
        setError(payload.error ?? 'Could not generate this bet slip.')
        return
      }
      const shareUrl =
        payload.shareUrl ?? payload.slip.shareUrl ?? `/bet/share/${payload.slip.code}`
      setResult({ ...payload, shareUrl })
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function copyLink() {
    const link = result?.shareUrl
    if (!link) return
    const absolute = link.startsWith('http') ? link : `${window.location.origin}${link}`
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const absoluteShare = result?.shareUrl
    ? result.shareUrl.startsWith('http')
      ? result.shareUrl
      : `${typeof window !== 'undefined' ? window.location.origin : ''}${result.shareUrl}`
    : ''

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
            <Sparkles className="h-4 w-4 text-accent" />
            Bet slip builder
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-text">
            Start from the model ranked picks, build the slip yourself, or generate fixtures from
            the random team pools. Set original, manual or simulated timing, adjust the odds and
            publish when it is ready.
          </p>
        </div>
        {creationMode === 'AI' ? (
          <button
            type="button"
            onClick={refreshPicks}
            disabled={refreshing || pending}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh AI picks'}
          </button>
        ) : null}
      </div>

      <div className="mt-4 inline-flex rounded-xl border border-border bg-background/40 p-1">
        <button
          type="button"
          onClick={() => switchMode('AI')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            creationMode === 'AI'
              ? 'bg-accent text-background'
              : 'text-muted-text hover:text-main-text'
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Use AI
        </button>
        <button
          type="button"
          onClick={() => switchMode('MANUAL')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            creationMode === 'MANUAL'
              ? 'bg-accent text-background'
              : 'text-muted-text hover:text-main-text'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Create manually
        </button>
        <button
          type="button"
          onClick={() => switchMode('RANDOM')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            creationMode === 'RANDOM'
              ? 'bg-accent text-background'
              : 'text-muted-text hover:text-main-text'
          }`}
        >
          <Shuffle className="h-3.5 w-3.5" />
          Random teams
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-main-text">
          <Clock className="h-3.5 w-3.5 text-accent" />
          Kickoff and live timing
        </p>
        <div className="mt-2 inline-flex flex-wrap gap-1">
          {(['ORIGINAL', 'MANUAL', 'SIMULATED'] as AdminSlipTimeMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimeMode(mode)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                timeMode === mode
                  ? 'bg-accent text-background'
                  : 'border border-border bg-surface text-muted-text hover:text-main-text'
              }`}
            >
              {mode === 'ORIGINAL'
                ? 'Original time'
                : mode === 'MANUAL'
                  ? 'Manual time'
                  : 'Simulated live'}
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-muted-text">
              {timeMode === 'ORIGINAL'
                ? 'Kickoff used for generated matches'
                : 'Manual kickoff time'}
            </span>
            <input
              type="datetime-local"
              value={manualKickoff}
              onChange={event => updateKickoff(event.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-main-text outline-none focus:border-accent/60"
            />
          </label>
          {timeMode === 'SIMULATED' ? (
            <label className="block sm:w-36">
              <span className="mb-1 block text-[10px] font-medium text-muted-text">
                Match minutes
              </span>
              <input
                type="number"
                min={5}
                max={180}
                step={5}
                value={simulatedDuration}
                onChange={event => setSimulatedDuration(event.target.value)}
                className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
              />
            </label>
          ) : null}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-text">
          {timeMode === 'ORIGINAL'
            ? 'Catalog kickoffs stay unchanged. Random teams use the kickoff above.'
            : timeMode === 'MANUAL'
              ? 'Every selection uses the kickoff above. Bets freeze at that time.'
              : 'Start the clock from the slip list when you are ready. Random matches are spaced 15 minutes apart; edit each kickoff below to set exact times. A match goes live only when its own kickoff passes.'}
        </p>
      </div>

      {creationMode === 'RANDOM' ? (
        <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[180px] flex-1">
              <span className="mb-1 block text-[10px] font-medium text-muted-text">
                Team pool
              </span>
              <select
                value={randomLeague}
                onChange={event => setRandomLeague(event.target.value)}
                className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-main-text outline-none focus:border-accent/60"
              >
                <option value="ANY">Any league</option>
                {RANDOM_TEAM_GROUPS.map(group => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24">
              <span className="mb-1 block text-[10px] font-medium text-muted-text">Matches</span>
              <input
                type="number"
                min={1}
                max={20}
                value={randomCount}
                onChange={event => setRandomCount(event.target.value)}
                className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
              />
            </label>
            <button
              type="button"
              onClick={() => generateRandomPicks(false)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Generate
            </button>
            <button
              type="button"
              onClick={() => generateRandomPicks(true)}
              disabled={pending || picked.length >= 20}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add more
            </button>
            <button
              type="button"
              onClick={addBlankRandomPick}
              disabled={pending || picked.length >= 20}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/15 disabled:opacity-60"
            >
              Add blank
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-text">
            Generate matches, add a blank row, or edit teams, kickoff and markets directly below.
            Every random fixture can use any market offered on a shared slip.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
            Slip title (optional)
          </span>
          <input
            type="text"
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={120}
            placeholder="e.g. Weekend banker"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
          />
        </label>
        <label className="block sm:w-40">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Stake (TZS)</span>
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

      <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-text">
            {creationMode === 'AI'
              ? 'Model picks'
              : creationMode === 'RANDOM'
                ? 'Random fixtures'
                : 'Your selections'}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-text">
            {creationMode === 'AI' && demo ? (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-200">
                Model data
              </span>
            ) : null}
            <span>{picked.length} matches</span>
            {creationMode === 'AI' ? (
              <span className="text-muted-text/60">{generatedLabel(generatedAt)}</span>
            ) : null}
          </div>
        </div>

        {picked.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-background/40 px-3 py-3 text-xs text-muted-text">
            {creationMode === 'MANUAL'
              ? 'No matches yet. Use the button below to add selections from the upcoming schedule.'
              : creationMode === 'RANDOM'
                ? 'No random fixtures yet. Generate a set above, then remove or add more as needed.'
                : 'No upcoming fixtures pass the model quality gates right now. Refresh or switch to manual creation.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {picked.map((item, index) => (
              <li
                key={`slip-selection-${index}`}
                className="rounded-lg border border-border bg-surface/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-main-text">
                      {index + 1}. {item.fixtureLabel}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-text">
                      {item.competition} | {item.kickoffLabel}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-accent">
                      {item.marketName}: {item.selectionLabel} |{' '}
                      {Math.round(item.probability * 100)}% model probability
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-text">Odds</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={MIN_ODDS}
                        max={MAX_ODDS}
                        step={0.01}
                        value={item.odds}
                        onChange={event => updateOdds(index, event.target.value)}
                        onBlur={() => {
                          if (validOdds(item.odds)) {
                            updateOdds(index, normalizeOddsValue(item.odds).toFixed(2))
                          }
                        }}
                        aria-label={`Odds for ${item.selectionLabel} in ${item.fixtureLabel}`}
                        className="w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removePick(item.fixtureId)}
                      aria-label={`Remove ${item.fixtureLabel}`}
                      className="rounded-lg border border-border bg-surface p-1.5 text-muted-text transition-colors hover:border-red-400/40 hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {item.custom ? (
                  <AdminEditableSelectionFields
                    value={item}
                    index={index}
                    onChange={patch => updatePicked(index, patch)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {creationMode === 'RANDOM' ? null : (
          <AdminSelectionPicker
            excludedFixtures={pickedFixtures}
            onAdd={addPick}
            disabled={pending}
          />
        )}

        {creationMode === 'AI' && picked.length > 0 && picked.length < 15 ? (
          <p className="mt-3 text-[10px] text-amber-200">
            Only {picked.length} fixtures pass the model gates right now. The generator targets 15
            or more when the schedule allows. Add more manually if needed.
          </p>
        ) : null}

        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center sm:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Stake</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {Number.isFinite(stakeMinor) ? formatTzs(stakeMinor) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {totalOdds > 0 ? formatOdds(totalOdds) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Gross</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-main-text">
              {potentialReturnMinor > 0 ? formatTzs(potentialReturnMinor) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-text">Net payout</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-accent">
              {potentialReturnMinor > 0 ? formatTzs(vatPreview.netPayoutMinor) : '-'}
            </dd>
          </div>
        </dl>
        <p className="mt-1.5 text-center text-[10px] text-muted-text">
          Less {VAT_PERCENT}% VAT: {formatTzs(vatPreview.vatMinor)} deducted from the gross return.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || picked.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {pending
            ? 'Publishing...'
            : creationMode === 'MANUAL'
              ? 'Create slip'
              : creationMode === 'RANDOM'
                ? 'Create random slip'
                : 'Publish slip'}
        </button>
        {picked.length > 0 && creationMode !== 'AI' ? (
          <button
            type="button"
            onClick={() => {
              clearFeedback()
              setPicked([])
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[11px] font-semibold text-muted-text transition-colors hover:border-red-400/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        ) : null}
        {error ? (
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : null}
      </div>

      {result?.slip ? (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
            <CircleCheck className="h-3.5 w-3.5" />
            Slip created
          </p>
          <p className="mt-2 text-xs text-main-text">
            Slip code:{' '}
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-accent">
              {result.slip.code}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-text">
            Total odds{' '}
            <span className="font-semibold tabular-nums text-main-text">
              {formatOdds(result.slip.totalOdds)}
            </span>{' '}
            | Net payout{' '}
            <span className="font-semibold tabular-nums text-accent">
              {formatTzs(result.slip.netPayoutMinor)}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-muted-text">
            Gross {formatTzs(result.slip.potentialReturnMinor)} | VAT 10%{' '}
            {formatTzs(result.slip.vatMinor)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-lg border border-border bg-background/60 px-2 py-1 text-[10px] text-muted-text">
              {absoluteShare}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40"
            >
              {copied ? (
                <CircleCheck className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
