'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Radio,
  Share2,
  Smartphone,
  Sparkles,
  Trophy,
  UserPlus,
  WalletCards,
} from 'lucide-react'
import { formatDateTimeLabel, formatTzs } from '@/lib/bet/format'
import { applyVat, VAT_PERCENT } from '@/lib/bet/vat'
import type { AviatorTrialView } from '@/lib/bet/aviator-trial'
import { matchClock, type MatchClockState } from '@/lib/bet/match-clock'
import { simulatedScore } from '@/lib/bet/simulation'
import type {
  BetEvent,
  BetSlipItem,
  BetTicketView,
  TicketSelection,
  TicketSimulationMeta,
} from '@/lib/bet/types'
import { isProviderFixtureId, MAX_STAKE_MINOR, slipStakeOptions } from '@/lib/bet/types'
import { TeamBadge } from '@/components/teams/team-badge'
import { BrandLogo } from '@/components/brand-logo'
import { BrandLoading } from '@/components/ui/brand-loading'
import { waitForMinimum } from '@/lib/loading'
import { AviatorPromoBanner } from './aviator-promo-banner'
import { AviatorPromoModal } from './aviator-promo-modal'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'
import { EventGrid } from './event-grid'
import { SectionHeading } from './section-heading'
import {
  SharedSlipReceipt,
  type SharedSlipMarker,
  type SharedSlipSelection,
} from './shared-slip-receipt'
import { useViewer } from '@/components/ui/viewer-provider'

type BetMode = 'LIVE' | 'SANDBOX'
type SlipStatus = 'OPEN' | 'FROZEN' | 'CLOSED'
type EntryStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'

interface AdminSlip {
  id: string
  code: string
  title: string | null
  mode: BetMode
  status: SlipStatus
  timeMode: 'ORIGINAL' | 'MANUAL' | 'SIMULATED'
  selectionSource: 'CATALOG' | 'RANDOM'
  manualKickoffAt: string | null
  simulatedDurationMinutes: number
  liveStartedAt: string | null
  frozen: boolean
  frozenReason?: string | null
  inPlay: boolean
  matchClock: Pick<
    MatchClockState,
    'phase' | 'label' | 'minute' | 'progress' | 'live' | 'finished'
  > | null
  clock: TicketSimulationMeta | null
  quote: {
    factor: number
    totalOdds: number
    potentialReturnMinor: number
    vatMinor: number
    netPayoutMinor: number
  }
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
  selections: TicketSelection[]
}

interface SlipEntry {
  id: string
  status: EntryStatus
  phoneMasked: string
  stakeMinor: number
  providerOrderId: string | null
  ticketId: string | null
  ticketCode: string | null
  paidAt: string | null
  createdAt: string
  message: string
}

interface SharedTeam {
  id?: string
  name: string
  short: string
  color: string
  logoUrl?: string | null
}

interface SharedLiveMatch {
  fixtureId: string
  competition: string
  kickoffIso: string
  minute: number | null
  label?: string
  score: { home: number; away: number } | null
  home: SharedTeam
  away: SharedTeam
}

interface EditSelectionDraft {
  fixtureId: string
  fixtureLabel: string
  competition: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: string
  kickoffIso: string
}

interface EditDraft {
  title: string
  stakeMinor: number
  manualKickoffAt: string
  originalManualKickoffAt: string
  selections: EditSelectionDraft[]
}

interface ShareResponse {
  share?: {
    code: string
    selections: TicketSelection[]
    expiresAt: string
    stale: boolean
  }
  slip?: AdminSlip
  live?: SharedLiveMatch[]
  liveGames?: BetEvent[]
  upcomingGames?: BetEvent[]
  minStakeMinor?: number
  error?: string
}

function teamsFromFixtureLabel(label: string, fixtureId: string): { home: SharedTeam; away: SharedTeam } {
  const [home = 'Home', away = 'Away'] = label.split(/\s+vs\.?\s+/i)
  return {
    home: {
      id: `${fixtureId}-home`,
      name: home,
      short: home.slice(0, 3).toUpperCase(),
      color: '#2563eb',
    },
    away: {
      id: `${fixtureId}-away`,
      name: away,
      short: away.slice(0, 3).toUpperCase(),
      color: '#dc2626',
    },
  }
}

function toSlipItem(selection: TicketSelection): BetSlipItem {
  return {
    key: `${selection.fixtureId}:${selection.marketId}:${selection.selectionId}`,
    fixtureId: selection.fixtureId,
    marketId: selection.marketId,
    selectionId: selection.selectionId,
    odds: selection.odds,
    fixtureLabel: selection.fixtureLabel,
    competition: selection.competition,
    marketName: selection.marketName,
    selectionLabel: selection.selectionLabel,
    kickoffIso: selection.kickoffIso,
  }
}

function kickoffLabel(selection: { kickoffIso: string }): string {
  const date = new Date(selection.kickoffIso)
  if (Number.isNaN(date.getTime())) return 'Kickoff time unavailable'
  return formatDateTimeLabel(selection.kickoffIso)
}

function statusClass(status: string): string {
  if (status === 'LIVE') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'OPEN' || status === 'PAID' || status === 'PLACED') {
    return 'border-accent/30 bg-accent/10 text-accent'
  }
  if (status === 'FROZEN' || status === 'PENDING') {
    return 'border-amber-700/30 bg-amber-700/10 text-amber-200'
  }
  return 'border-red-700/30 bg-red-700/10 text-red-300'
}

function StakePicker({
  stakeMinor,
  minStakeMinor,
  onChange,
}: {
  stakeMinor: number
  minStakeMinor: number
  onChange: (value: number) => void
}) {
  const options = useMemo(() => slipStakeOptions(minStakeMinor), [minStakeMinor])
  return (
    <div className="mt-3">
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-text">
          Stake (TZS)
        </span>
        <input
          type="number"
          min={minStakeMinor}
          max={MAX_STAKE_MINOR}
          step={100}
          value={stakeMinor}
          onChange={event => onChange(Number(event.target.value))}
          className="w-full rounded-lg border border-border bg-background/50 px-2.5 py-2 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
        />
      </label>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-text">Quick stake</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map(amount => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(amount)}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              stakeMinor === amount
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-background/40 text-main-text hover:border-accent/40'
            }`}
          >
            {formatTzs(amount)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-text">
        Minimum {formatTzs(minStakeMinor)}. Enter any amount above the minimum.
      </p>
    </div>
  )
}

function promoDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'dismissed'
  } catch {
    return false
  }
}

function dismissPromo(key: string): void {
  try {
    window.localStorage.setItem(key, 'dismissed')
  } catch {
    return
  }
}

function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function markerForSelection(
  selection: TicketSelection,
  status: string,
  failed: boolean,
): SharedSlipMarker {
  if (failed || selection.result === 'LOST') return 'red'
  if (selection.result === 'WON' || status === 'PAID') return 'green'
  return 'gray'
}

export function ShareLoader({ code }: { code: string }) {
  const router = useRouter()
  const { refreshViewer } = useViewer()
  const {
    viewer: slipViewer,
    items,
    stakeMinor,
    setStakeMinor,
    setSharedSlip,
    unlockSlip,
    openSlip,
    refreshWallet,
    totalOdds,
    potentialReturnMinor,
    placeBet,
    placing,
    wallet,
    walletLoading,
  } = useBetSlip()
  const { minStakeMinor: configuredMinStakeMinor } = useBetMode()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [slip, setSlip] = useState<AdminSlip | null>(null)
  const [live, setLive] = useState<SharedLiveMatch[]>([])
  const [liveGames, setLiveGames] = useState<BetEvent[]>([])
  const [upcomingGames, setUpcomingGames] = useState<BetEvent[]>([])
  const [minStakeMinor, setMinStakeMinor] = useState(configuredMinStakeMinor)
  const [paymentStakeMinor, setPaymentStakeMinor] = useState(0)
  const [phone, setPhone] = useState('')
  const [paying, setPaying] = useState(false)
  const [entry, setEntry] = useState<SlipEntry | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [promo, setPromo] = useState<AviatorTrialView | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [ticket, setTicket] = useState<BetTicketView | null>(null)
  const [placedTicket, setPlacedTicket] = useState<BetTicketView | null>(null)
  const [cashingOut, setCashingOut] = useState(false)
  const [cashoutError, setCashoutError] = useState<string | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [republished, setRepublished] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [winnerUrl, setWinnerUrl] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const loadedCode = useRef<string | null>(null)
  const promoStarted = useRef(false)
  const activePaymentStakeMinor = paymentStakeMinor || slip?.stakeMinor || 0

  const activeClock = slip?.clock ?? null
  const activeMatch = activeClock ? matchClock(activeClock, now) : null
  const signedIn = Boolean(slipViewer?.userId)
  const canUseSpecial = Boolean(
    slipViewer?.userId &&
      (slipViewer.isSpecial || slipViewer.role === 'ADMIN' || slipViewer.role === 'SUPER_ADMIN'),
  )
  const isAdminSlip = Boolean(slip)
  const paid = entry?.status === 'PAID'
  const pending = entry?.status === 'PENDING'
  const failed = entry?.status === 'FAILED' || entry?.status === 'CANCELLED'
  const frozen = isAdminSlip ? !slip!.inPlay && (slip!.frozen || slip!.status === 'CLOSED') : false
  const canPay = !frozen && !paid && !pending
  const walletBalanceMinor = wallet?.balanceMinor ?? 0
  const hasWalletFunds = walletBalanceMinor >= activePaymentStakeMinor

  const simulatedLiveMatches = useMemo<SharedLiveMatch[]>(() => {
    if (!slip || !activeClock) return []
    return slip.selections.flatMap(selection => {
      if (isProviderFixtureId(selection.fixtureId)) return []
      const clock = selection.simulation ?? activeClock
      const clockState = matchClock(clock, now)
      if (!clockState.live) return []
      const teams = teamsFromFixtureLabel(selection.fixtureLabel, selection.fixtureId)
      return [
        {
          fixtureId: selection.fixtureId,
          competition: selection.competition,
          kickoffIso: clock.kickoffIso ?? selection.kickoffIso,
          minute: clockState.minute,
          label: clockState.label,
          score: simulatedScore(selection, clock, clockState.minute),
          ...teams,
        },
      ]
    })
  }, [slip, activeClock, now])

  const simulatedLive = simulatedLiveMatches.length > 0
  const liveBadgeLabel = simulatedLiveMatches[0]?.label ?? activeMatch?.label ?? null
  const awaitingSimulatedStart =
    slip?.timeMode === 'SIMULATED' && !slip.liveStartedAt && slip.status !== 'CLOSED'

  const receiptSelections = useMemo<SharedSlipSelection[]>(() => {
    const source: Array<TicketSelection | BetSlipItem> = isAdminSlip ? slip!.selections : items
    return source.map((selection, index) => {
      const ticketSelection = selection as TicketSelection
      const marker = isAdminSlip
        ? markerForSelection(ticketSelection, paid ? 'PAID' : slip!.status, failed)
        : placedTicket
          ? 'green'
          : 'gray'
      const finalScore = ticketSelection.finalScore
      return {
        key: `${selection.fixtureId}:${selection.marketId}:${selection.selectionId}:${index}`,
        time: kickoffLabel(selection),
        fixtureLabel: selection.fixtureLabel,
        competition: selection.competition,
        marketName: selection.marketName,
        selectionLabel: selection.selectionLabel,
        odds: selection.odds,
        marker,
        finalScore: finalScore ? `${finalScore.home} - ${finalScore.away}` : null,
      }
    })
  }, [failed, isAdminSlip, items, paid, placedTicket, slip])

  const receiptStakeMinor = isAdminSlip ? activePaymentStakeMinor : stakeMinor
  const receiptOdds = isAdminSlip
    ? slip!.inPlay
      ? slip!.quote.totalOdds
      : slip!.totalOdds
    : totalOdds
  const receiptGrossMinor = isAdminSlip
    ? Math.floor(receiptOdds * activePaymentStakeMinor)
    : potentialReturnMinor
  const receiptVat = applyVat(receiptGrossMinor)
  const receiptStatus = isAdminSlip
    ? paid
      ? 'PAID'
      : slip!.inPlay
        ? 'LIVE'
        : slip!.status
    : placedTicket
      ? 'PLACED'
      : 'OPEN'
  const nextKickoffIso = isAdminSlip
    ? slip!.selections
        .map(selection => selection.kickoffIso)
        .filter(value => !Number.isNaN(new Date(value).getTime()))
        .filter(value => new Date(value).getTime() > now)
        .sort()[0] ?? null
    : null

  useEffect(() => {
    if (loadedCode.current === code) return
    loadedCode.current = code
    let cancelled = false
    setState('loading')
    setSlip(null)
    setTicket(null)
    setPlacedTicket(null)

    async function load() {
      const startedAt = Date.now()
      try {
        const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as ShareResponse
        if (cancelled) return
        if (!response.ok || (!payload.share && !payload.slip)) {
          setState('error')
          setMessage(payload.error ?? 'That share link could not be loaded.')
          return
        }
        await waitForMinimum(startedAt)
        if (cancelled) return
        if (payload.slip) {
          setSlip(payload.slip)
          setPaymentStakeMinor(payload.slip.stakeMinor)
        } else if (payload.share) {
          const selections = payload.share.selections
          setSharedSlip(selections.map(toSlipItem))
          setStale(payload.share.stale)
          unlockSlip()
          openSlip()
        }
        setLive(payload.live ?? [])
        setLiveGames(payload.liveGames ?? [])
        setUpcomingGames(payload.upcomingGames ?? [])
        setMinStakeMinor(payload.minStakeMinor ?? configuredMinStakeMinor)
        setState('ready')
      } catch {
        if (!cancelled) {
          setState('error')
          setMessage('Network error while loading the share link.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [code, configuredMinStakeMinor, openSlip, setSharedSlip, unlockSlip])

  useEffect(() => () => unlockSlip(), [unlockSlip])

  useEffect(() => {
    if (state !== 'ready') return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as ShareResponse
        if (cancelled || !response.ok) return
        if (payload.live) setLive(payload.live)
        if (payload.liveGames) setLiveGames(payload.liveGames)
        if (payload.upcomingGames) setUpcomingGames(payload.upcomingGames)
        if (payload.minStakeMinor) setMinStakeMinor(payload.minStakeMinor)
        if (payload.slip) setSlip(payload.slip)
      } catch {
        return
      }
    }, awaitingSimulatedStart ? 5_000 : 30_000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [awaitingSimulatedStart, code, state])

  useEffect(() => {
    if (!entry || entry.status !== 'PENDING') return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/bet/share/entries/${encodeURIComponent(entry.id)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as { entry?: SlipEntry }
        if (!cancelled && payload.entry) setEntry(payload.entry)
      } catch {
        return
      }
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [entry])

  useEffect(() => {
    if (!entry || entry.status !== 'PAID' || promoStarted.current) return
    const storageKey = `spotibet.aviator-promo.${entry.id}`
    if (promoDismissed(storageKey)) return
    promoStarted.current = true
    let cancelled = false

    async function unlockTrial() {
      try {
        const response = await fetch('/api/bet/aviator-trial/start', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: entry?.id }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          trial?: AviatorTrialView
          error?: string
        }
        if (cancelled || !response.ok || !payload.trial?.canPlay) return
        setPromo(payload.trial)
        setPromoOpen(true)
      } catch {
        setPromoOpen(false)
      }
    }

    void unlockTrial()
    return () => {
      cancelled = true
    }
  }, [entry])

  useEffect(() => {
    if (!simulatedLive && !slip?.inPlay) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [simulatedLive, slip?.inPlay])

  useEffect(() => {
    const ticketId = entry?.ticketId ?? ''
    if (entry?.status !== 'PAID' || !ticketId) return
    let cancelled = false
    async function loadTicket() {
      try {
        const response = await fetch(`/api/bet/bets/${encodeURIComponent(ticketId)}`, {
          cache: 'no-store',
          credentials: 'include',
        })
        const payload = (await response.json().catch(() => ({}))) as {
          ticket?: BetTicketView
          error?: string
        }
        if (!cancelled && response.ok && payload.ticket) setTicket(payload.ticket)
      } catch {
        return
      }
    }
    void loadTicket()
    const timer = setInterval(() => void loadTicket(), ticket?.status === 'OPEN' ? 10_000 : 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [entry?.status, entry?.ticketId, ticket?.status])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  function closePromo() {
    setPromoOpen(false)
    if (!entry) return
    dismissPromo(`spotibet.aviator-promo.${entry.id}`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function handleSignOut() {
    setMenuOpen(false)
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Sign out failed')
      await refreshViewer()
      router.replace('/bet')
      router.refresh()
    } catch {
      setMenuOpen(true)
    }
  }

  async function cashout() {
    if (!entry?.ticketId || cashingOut) return
    setCashingOut(true)
    setCashoutError(null)
    try {
      const response = await fetch(
        `/api/bet/bets/${encodeURIComponent(entry.ticketId)}/cashout`,
        { method: 'POST', credentials: 'include' },
      )
      const payload = (await response.json().catch(() => ({}))) as {
        ticket?: BetTicketView
        error?: string
      }
      if (!response.ok || !payload.ticket) {
        setCashoutError(payload.error ?? 'Could not cash out this ticket.')
        return
      }
      setTicket(payload.ticket)
      await refreshWallet()
      router.refresh()
    } catch {
      setCashoutError('Network error. Please try again.')
    } finally {
      setCashingOut(false)
    }
  }

  async function startPayment(source: 'wallet' | 'phone') {
    if (paying || !slip) return
    setPayError(null)
    if (!slip.inPlay && (slip.frozen || slip.status === 'CLOSED')) {
      setPayError(slip.frozenReason || 'Betting is closed for this slip.')
      return
    }
    if (activePaymentStakeMinor < minStakeMinor) {
      setPayError(`The minimum stake is now ${formatTzs(minStakeMinor)}.`)
      return
    }
    const cleaned = phone.trim()
    if (source === 'phone' && cleaned.length < 7) {
      setPayError('Enter the mobile-money number you want to pay with.')
      return
    }
    setPaying(true)
    try {
      const response = await fetch('/api/bet/share/payment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          phone: source === 'wallet' ? '' : cleaned,
          source,
          stakeMinor: activePaymentStakeMinor,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        entry?: SlipEntry
        slip?: AdminSlip
      }
      if (!response.ok) {
        setPayError(payload.error ?? 'Could not start the payment.')
        return
      }
      if (payload.slip) setSlip(payload.slip)
      if (payload.entry) setEntry(payload.entry)
      if (source === 'wallet') await refreshWallet()
    } catch {
      setPayError('Network error. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  async function placeSharedBet() {
    if (placing) return
    setPlaceError(null)
    if (!signedIn) {
      setPlaceError('Sign in before placing this bet.')
      return
    }
    if (stakeMinor < minStakeMinor) {
      setPlaceError(`Enter at least ${formatTzs(minStakeMinor)} as your stake.`)
      return
    }
    const result = await placeBet()
    if (!result.ok) {
      setPlaceError(result.error ?? 'Could not place this bet.')
      return
    }
    setPlacedTicket(result.ticket ?? null)
    await refreshWallet()
    router.refresh()
  }

  function beginEdit() {
    if (!slip) return
    setEditMessage(null)
    setRepublished(false)
    const manualKickoffAt = toDateTimeInput(slip.manualKickoffAt ?? slip.selections[0]?.kickoffIso)
    setEditDraft({
      title: slip.title ?? '',
      stakeMinor: slip.stakeMinor,
      manualKickoffAt,
      originalManualKickoffAt: manualKickoffAt,
      selections: slip.selections.map(selection => ({
        fixtureId: selection.fixtureId,
        fixtureLabel: selection.fixtureLabel,
        competition: selection.competition,
        marketId: selection.marketId,
        marketName: selection.marketName,
        selectionId: selection.selectionId,
        selectionLabel: selection.selectionLabel,
        odds: String(selection.odds),
        kickoffIso: toDateTimeInput(selection.kickoffIso),
      })),
    })
  }

  function updateEditSelection(index: number, patch: Partial<EditSelectionDraft>) {
    setEditDraft(current =>
      current
        ? {
            ...current,
            selections: current.selections.map((selection, position) =>
              position === index ? { ...selection, ...patch } : selection,
            ),
          }
        : current,
    )
  }

  async function saveEdit(republish = false) {
    if (!editDraft || editBusy) return
    setEditBusy(true)
    setEditMessage(null)
    setRepublished(false)
    const kickoffChanged = editDraft.manualKickoffAt !== editDraft.originalManualKickoffAt
    try {
      const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}/edit`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDraft.title.trim() || null,
          stakeMinor: editDraft.stakeMinor,
          republish,
          ...(kickoffChanged ? { manualKickoffAt: fromDateTimeInput(editDraft.manualKickoffAt) } : {}),
          selections: editDraft.selections.map(selection => ({
            fixtureId: selection.fixtureId,
            fixtureLabel: selection.fixtureLabel,
            competition: selection.competition,
            marketId: selection.marketId,
            marketName: selection.marketName,
            selectionId: selection.selectionId,
            selectionLabel: selection.selectionLabel,
            odds: Number(selection.odds),
            kickoffIso: fromDateTimeInput(selection.kickoffIso),
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        slip?: AdminSlip
        error?: string
      }
      if (!response.ok || !payload.slip) {
        setEditMessage(payload.error ?? 'Could not save these changes.')
        return
      }
      setSlip(payload.slip)
      setEditDraft(null)
      setRepublished(republish)
      setEditMessage(
        republish
          ? 'Slip republished. It is open again and the same share link is active.'
          : 'Slip updated. The new kickoff and prices are now live.',
      )
      router.refresh()
    } catch {
      setEditMessage('Network error. Please try again.')
    } finally {
      setEditBusy(false)
    }
  }

  async function claimWinner() {
    if (claiming) return
    setClaiming(true)
    setEditMessage(null)
    try {
      const response = await fetch(`/api/bet/share/${encodeURIComponent(code)}/winner`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry?.id ? { entryId: entry.id } : {}),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        shareUrl?: string
        error?: string
      }
      if (!response.ok || !payload.shareUrl) {
        setEditMessage(payload.error ?? 'Could not assign this win to you.')
        return
      }
      setWinnerUrl(payload.shareUrl)
      await refreshWallet()
      router.refresh()
    } catch {
      setEditMessage('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  function liveMatchPanel(title: string, matches: SharedLiveMatch[]) {
    if (matches.length === 0) return null
    return (
      <div className="receipt-rule mt-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            {title}
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-text">
            {matches.length} in play
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {matches.map(match => (
            <li
              key={match.fixtureId}
              className="rounded-xl border border-red-700/20 bg-red-700/5 p-2.5"
            >
              <p className="truncate text-[10px] text-muted-text">{match.competition}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamBadge team={match.home} size="xs" />
                  <span className="truncate text-[11px] font-semibold text-main-text">
                    {match.home.name}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-background/60 px-2 py-1 font-mono text-sm font-bold tabular-nums text-main-text">
                  {match.score ? `${match.score.home} - ${match.score.away}` : 'vs'}
                </span>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right text-[11px] font-semibold text-main-text">
                    {match.away.name}
                  </span>
                  <TeamBadge team={match.away} size="xs" />
                </div>
              </div>
              <p className="mt-1.5 text-center text-[10px] font-semibold text-red-300">
                {match.label ?? liveBadgeLabel ?? (match.minute ? `${match.minute}'` : 'In play')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-background">
        <BrandLoading className="min-h-0 w-full max-w-sm" message="Loading shared slip" />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <CircleAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Share link unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          {message ?? 'Share codes expire after 24 hours.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/bet/sports"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            Browse sportsbook
          </Link>
          <Link
            href="/bet"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
          >
            Back to bet home
          </Link>
        </div>
      </div>
    )
  }

  if (!slip) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <AviatorPromoBanner />
        <SharedSlipReceipt
          code={code}
          title="Shared bet slip"
          status={receiptStatus}
          selections={receiptSelections}
          stakeMinor={receiptStakeMinor}
          totalOdds={receiptOdds}
          potentialReturnMinor={receiptGrossMinor}
          vatMinor={receiptVat.vatMinor}
          netPayoutMinor={receiptVat.netPayoutMinor}
          won={placedTicket?.status === 'WON'}
          copied={copied}
          onCopy={() => void copyLink()}
        >
          {stale ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              One or more prices changed since this slip was shared. Check the odds before you bet.
            </div>
          ) : null}

          {placedTicket ? (
            <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-3 text-center">
              <CircleCheck className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-2 text-sm font-semibold text-main-text">Bet placed</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-[0.18em] text-accent">
                {placedTicket.code}
              </p>
              <Link
                href="/bet/bets"
                className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-[11px] font-bold text-background"
              >
                View my bets
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
                  <WalletCards className="h-4 w-4 text-accent" />
                  Take this slip
                </h2>
                <span className="text-[10px] uppercase tracking-wide text-muted-text">
                  Min {formatTzs(minStakeMinor)}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-text">
                The selections are editable. Add more matches, set your stake and place the bet.
              </p>
              {signedIn ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-text">
                        Wallet · {walletLoading && !wallet ? '…' : formatTzs(walletBalanceMinor)}
                      </p>
                      <p className="mt-1 font-mono text-xs font-bold text-main-text">
                        {receiptSelections.length} selections
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                      <p className="mt-1 font-mono text-xs font-bold text-main-text">
                        {formatTzs(stakeMinor)}
                      </p>
                    </div>
                  </div>
                  <StakePicker
                    stakeMinor={stakeMinor}
                    minStakeMinor={minStakeMinor}
                    onChange={setStakeMinor}
                  />
                  <button
                    type="button"
                    onClick={() => void placeSharedBet()}
                    disabled={placing || stakeMinor < minStakeMinor}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
                    {placing ? 'Placing bet…' : `Place bet · ${formatTzs(stakeMinor)}`}
                  </button>
                </>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-background"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign in to bet
                  </Link>
                  <button
                    type="button"
                    onClick={openSlip}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-main-text"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Open bet slip
                  </button>
                </div>
              )}
              {placeError ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300">
                  <CircleAlert className="h-3.5 w-3.5" />
                  {placeError}
                </p>
              ) : null}
            </div>
          )}

          {upcomingGames.length > 0 ? (
            <div className="receipt-rule mt-4 pt-4">
              <SectionHeading
                eyebrow="Customize"
                title="Add more selections"
                description="Pick another outcome to extend this multibet."
                action="All fixtures"
                actionHref="/bet/sports"
              />
              <div className="mt-3">
                <EventGrid events={upcomingGames.slice(0, 6)} />
              </div>
            </div>
          ) : null}
        </SharedSlipReceipt>

        {liveGames.length > 0 ? (
          <section>
            <SectionHeading
              eyebrow="In play"
              title="Live games"
              description="Scores refresh automatically while these matches are in play."
              action="All live"
              actionHref="/bet/live"
            />
            <EventGrid events={liveGames.slice(0, 6)} />
          </section>
        ) : null}

        {promoOpen && promo ? <AviatorPromoModal trial={promo} onClose={closePromo} /> : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AviatorPromoBanner />

      {slip.inPlay ? (
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Match has started{liveBadgeLabel ? ` · ${liveBadgeLabel}` : ''}. New stakes use live odds.
          </span>
          <Link
            href={`/bet/live?slip=${encodeURIComponent(slip.code)}`}
            className="font-bold underline underline-offset-4 hover:no-underline"
          >
            See live updates →
          </Link>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[520px] flex-wrap items-center justify-between gap-3">
        <BrandLogo surface="dark" className="h-12 w-auto" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(value => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="shared-slip-account-menu"
              aria-label="Open profile menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-main-text transition-colors hover:border-accent/40 hover:bg-white/10"
            >
              <Menu className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                id="shared-slip-account-menu"
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
              >
                {signedIn ? (
                  <>
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-sm font-semibold text-main-text">
                        {slipViewer?.name?.trim() || slipViewer?.email || 'Account'}
                      </p>
                      <p className="truncate text-[11px] text-muted-text">{slipViewer?.email}</p>
                    </div>
                    <nav className="flex flex-col py-1.5">
                      <Link href="/bet/bets" role="menuitem" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                        My bets
                      </Link>
                      <Link href="/bet/account" role="menuitem" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                        Wallet
                      </Link>
                      {canUseSpecial ? (
                        <Link href="/admin" role="menuitem" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                          Special tools
                        </Link>
                      ) : null}
                      <Link href="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                        Dashboard
                      </Link>
                    </nav>
                    <div className="border-t border-border p-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-main-text hover:bg-white/5"
                      >
                        <LogOut className="h-4 w-4 text-muted-text" />
                        Sign out
                      </button>
                    </div>
                  </>
                ) : (
                  <nav className="flex flex-col py-1.5">
                    <Link href="/sign-in" role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                      <LogIn className="h-4 w-4 text-accent" />
                      Sign in
                    </Link>
                    <Link href="/sign-up" role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                      <UserPlus className="h-4 w-4 text-accent" />
                      Create account
                    </Link>
                    <Link href="/bet/sports" role="menuitem" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5">
                      Browse sportsbook
                    </Link>
                  </nav>
                )}
              </div>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(receiptStatus)}`}
          >
            {receiptStatus}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-[10px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:bg-white/10 hover:text-main-text"
          >
            {copied ? <CircleCheck className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>

      <SharedSlipReceipt
        code={slip.code}
        title={slip.title}
        status={receiptStatus}
        selections={receiptSelections}
        stakeMinor={receiptStakeMinor}
        totalOdds={receiptOdds}
        potentialReturnMinor={receiptGrossMinor}
        vatMinor={receiptVat.vatMinor}
        netPayoutMinor={receiptVat.netPayoutMinor}
        won={
          ticket?.status === 'WON' ||
          (slip.selections.length > 0 &&
            slip.selections.every(selection => selection.result === 'WON'))
        }
        copied={copied}
        onCopy={() => void copyLink()}
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-text">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-accent" />
            Created {formatDateTimeLabel(slip.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {simulatedLive || activeMatch?.live
              ? `Match clock ${liveBadgeLabel ?? activeMatch?.label ?? ''}`
              : nextKickoffIso
                ? `Starts ${formatDateTimeLabel(nextKickoffIso)}`
                : `Closes ${formatDateTimeLabel(slip.autoFreezeAt)}`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5 text-accent" />
            {slip.selections.length} selections
          </span>
        </div>

        {slip.inPlay ? (
          <p className="mt-2 text-center text-[10px] font-semibold text-emerald-300">
            Live prices are reduced as the match progresses. A stake placed now settles at these odds.
          </p>
        ) : null}

        {frozen ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-700/25 bg-amber-700/10 px-3 py-2 text-xs text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{slip.frozenReason || 'Betting is closed for this slip.'}</span>
          </div>
        ) : null}

        {canUseSpecial ? (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                Special slip controls
              </p>
              <button
                type="button"
                onClick={() => (editDraft ? setEditDraft(null) : beginEdit())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-300/20"
              >
                <Pencil className="h-3 w-3" />
                {editDraft ? 'Cancel edit' : 'Edit / republish slip'}
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-text">
              Special users can update title, stake, odds, labels and kickoff even after a match has
              finished. Save &amp; republish reopens the slip and reactivates the same share link.
              Every edit is audited.
            </p>

            {editDraft ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-muted-text">Title</span>
                    <input
                      type="text"
                      value={editDraft.title}
                      maxLength={120}
                      onChange={event =>
                        setEditDraft(current =>
                          current ? { ...current, title: event.target.value } : current,
                        )
                      }
                      className="w-full rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[11px] text-main-text outline-none focus:border-amber-300/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-muted-text">Stake (TZS)</span>
                    <input
                      type="number"
                      min={minStakeMinor}
                      step={100}
                      value={editDraft.stakeMinor}
                      onChange={event =>
                        setEditDraft(current =>
                          current
                            ? { ...current, stakeMinor: Number(event.target.value) }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[11px] font-semibold tabular-nums text-main-text outline-none focus:border-amber-300/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-muted-text">Slip kickoff</span>
                    <input
                      type="datetime-local"
                      value={editDraft.manualKickoffAt}
                      onChange={event =>
                        setEditDraft(current =>
                          current
                            ? { ...current, manualKickoffAt: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[11px] font-semibold text-main-text outline-none focus:border-amber-300/60"
                    />
                  </label>
                </div>

                {editDraft.selections.map((selection, index) => (
                  <div key={`${selection.fixtureId}:${index}`} className="rounded-lg border border-border bg-background/40 p-2.5">
                    <p className="truncate text-[11px] font-semibold text-main-text">
                      {index + 1}. {selection.fixtureLabel || 'Selection'}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <input
                        type="text"
                        value={selection.marketName}
                        onChange={event => updateEditSelection(index, { marketName: event.target.value })}
                        aria-label={`Selection ${index + 1} market`}
                        className="rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-[10px] text-main-text outline-none focus:border-amber-300/60"
                      />
                      <input
                        type="text"
                        value={selection.selectionLabel}
                        onChange={event => updateEditSelection(index, { selectionLabel: event.target.value })}
                        aria-label={`Selection ${index + 1} label`}
                        className="rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-[10px] text-main-text outline-none focus:border-amber-300/60"
                      />
                      <input
                        type="number"
                        min={1.01}
                        max={1000}
                        step={0.01}
                        value={selection.odds}
                        onChange={event => updateEditSelection(index, { odds: event.target.value })}
                        aria-label={`Selection ${index + 1} odds`}
                        className="rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-[10px] font-semibold tabular-nums text-main-text outline-none focus:border-amber-300/60"
                      />
                      <input
                        type="datetime-local"
                        value={selection.kickoffIso}
                        onChange={event => updateEditSelection(index, { kickoffIso: event.target.value })}
                        aria-label={`Selection ${index + 1} kickoff`}
                        className="rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-[10px] text-main-text outline-none focus:border-amber-300/60"
                      />
                    </div>
                  </div>
                ))}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={editBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-[11px] font-bold text-amber-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {editBusy ? 'Saving edits…' : 'Save slip edits'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit(true)}
                    disabled={editBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition-opacity hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                    {editBusy ? 'Republishing…' : 'Save & republish'}
                  </button>
                </div>
              </div>
            ) : null}

            {republished ? (
              <button
                type="button"
                onClick={() => void copyLink()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Link copied' : 'Copy republished link'}
              </button>
            ) : null}

            {canUseSpecial ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => void claimWinner()}
                  disabled={claiming}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                  {claiming ? 'Assigning…' : 'Assign my winner slip'}
                </button>
                <span className="text-[10px] text-muted-text">
                  Only works with a paid entry registered to this account.
                </span>
              </div>
            ) : null}

            {winnerUrl ? (
              <Link
                href={winnerUrl}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-300/20"
              >
                <Trophy className="h-3.5 w-3.5" />
                Open my winner slip
              </Link>
            ) : null}
            {editMessage ? <p className="mt-2 text-[10px] text-amber-200">{editMessage}</p> : null}
          </div>
        ) : null}

        {liveMatchPanel('Live matches', simulatedLiveMatches)}
        {liveMatchPanel('Live now', live)}

        {paid ? (
          <div className="receipt-rule mt-5 pt-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <CircleCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">Bet confirmed</h2>
            <p className="mt-1 text-sm text-muted-text">{entry?.message}</p>
            {entry?.ticketCode ? (
              <div className="mx-auto mt-4 max-w-xs rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-main-text">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Ticket code</p>
                <p className="font-mono text-base font-bold tracking-[0.18em] text-accent">
                  {entry.ticketCode}
                </p>
              </div>
            ) : null}
            {entry?.ticketId && (ticket?.status === 'OPEN' || ticket?.status === 'CASHED_OUT') ? (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Cash-out offer
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-300">
                  {formatTzs(ticket?.cashoutOfferMinor ?? 0)}
                </p>
                {ticket?.status === 'CASHED_OUT' ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                    Cashed out for {formatTzs(ticket.payoutMinor)}
                  </p>
                ) : ticket?.cashoutOfferMinor != null ? (
                  <button
                    type="button"
                    onClick={() => void cashout()}
                    disabled={cashingOut}
                    className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {cashingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                    Cash out now
                  </button>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-text">
                    Cash-out offer recalculates as the match progresses.
                  </p>
                )}
                {cashoutError ? <p className="mt-1 text-[10px] text-red-300">{cashoutError}</p> : null}
              </div>
            ) : null}
            {ticket && (ticket.status === 'WON' || ticket.status === 'LOST' || ticket.status === 'VOID') ? (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-border bg-background/40 px-3 py-2.5 text-center text-xs text-muted-text">
                {ticket.status === 'WON'
                  ? `You won ${formatTzs(ticket.payoutMinor)}. The payout is in your wallet.`
                  : ticket.status === 'LOST'
                    ? 'This ticket did not win.'
                    : 'This ticket was voided and returned to your wallet.'}
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/bet/bets" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background">
                View my bets
              </Link>
              <Link href="/bet/sports" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40">
                Keep browsing
              </Link>
            </div>
          </div>
        ) : (
          <div className="receipt-rule mt-5 pt-5">
            {signedIn ? (
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <WalletCards className="h-4 w-4 text-accent" />
                  Pay from wallet
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-text">
                  Your bet is placed instantly and winnings return to your wallet.
                </p>
                <StakePicker
                  stakeMinor={activePaymentStakeMinor}
                  minStakeMinor={minStakeMinor}
                  onChange={setPaymentStakeMinor}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-text">Balance</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-main-text">
                      {walletLoading && !wallet ? '…' : formatTzs(walletBalanceMinor)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-main-text">
                      {formatTzs(activePaymentStakeMinor)}
                    </p>
                  </div>
                </div>
                {activePaymentStakeMinor < minStakeMinor ? (
                  <div className="mt-3 rounded-xl border border-amber-700/25 bg-amber-700/10 px-3 py-2 text-[11px] text-amber-200">
                    The minimum stake is now {formatTzs(minStakeMinor)}. Choose a quick stake or enter
                    a custom amount above the minimum.
                  </div>
                ) : null}
                {!hasWalletFunds && !walletLoading ? (
                  <div className="mt-3 rounded-xl border border-amber-700/25 bg-amber-700/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                    Add funds to your wallet to take this slip.{' '}
                    <Link href="/bet/deposit" className="font-bold underline underline-offset-2">
                      Add funds
                    </Link>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void startPayment('wallet')}
                  disabled={
                    !canPay ||
                    paying ||
                    frozen ||
                    !hasWalletFunds ||
                    walletLoading ||
                    !wallet ||
                    activePaymentStakeMinor < minStakeMinor
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
                  {paying ? 'Placing bet…' : `Place bet · ${formatTzs(activePaymentStakeMinor)}`}
                </button>
              </div>
            ) : (
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Smartphone className="h-4 w-4 text-accent" />
                  Confirm and pay
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-text">
                  Enter the mobile-money number. You will get a prompt to approve the payment, then
                  the bet is placed automatically.
                </p>
                <StakePicker
                  stakeMinor={activePaymentStakeMinor}
                  minStakeMinor={minStakeMinor}
                  onChange={setPaymentStakeMinor}
                />
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
                    Mobile number
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                    placeholder="07XX XXX XXX"
                    disabled={!canPay && !failed}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60 disabled:opacity-60"
                  />
                </label>
                {pending ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs text-accent">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for the mobile-money prompt on {entry?.phoneMasked ?? 'your phone'}...
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void startPayment('phone')}
                  disabled={!canPay || paying || frozen || activePaymentStakeMinor < minStakeMinor}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  {paying ? 'Starting payment…' : `Pay ${formatTzs(activePaymentStakeMinor)}`}
                </button>
              </div>
            )}

            {failed ? (
              <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-red-700/25 bg-red-700/10 px-3 py-2 text-xs text-red-300">
                <CircleAlert className="h-4 w-4" />
                {entry?.message ?? 'The bet could not be placed. You can try again.'}
              </p>
            ) : null}
            {payError ? (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
                <CircleAlert className="h-3.5 w-3.5" />
                {payError}
              </p>
            ) : null}
          </div>
        )}

        <div className="receipt-rule mt-5 pt-3 text-center">
          <div className="receipt-barcode" aria-hidden />
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            {paid
              ? 'Bet accepted'
              : frozen
                ? 'Betting closed'
                : pending
                  ? 'Awaiting payment'
                  : failed
                    ? 'Payment failed'
                    : readyStatusLabel(slip)}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-muted-text">
            Includes {VAT_PERCENT}% VAT deducted from gross returns · {slip.code}
          </p>
        </div>
      </SharedSlipReceipt>

      {liveGames.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="In play"
            title="Live games"
            description="Scores refresh automatically while these matches are in play."
            action="All live"
            actionHref="/bet/live"
          />
          <EventGrid events={liveGames.slice(0, 6)} />
        </section>
      ) : null}

      {promoOpen && promo ? <AviatorPromoModal trial={promo} onClose={closePromo} /> : null}
    </div>
  )
}

function readyStatusLabel(slip: AdminSlip): string {
  return slip.status === 'FROZEN' ? 'Betting paused' : 'Ready to play'
}
