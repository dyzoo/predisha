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
  Share2,
  Smartphone,
  UserPlus,
  WalletCards,
} from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
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
import { TeamBadge } from '@/components/teams/team-badge'
import { BrandLogo } from '@/components/brand-logo'
import { BrandLoading } from '@/components/ui/brand-loading'
import { waitForMinimum } from '@/lib/loading'
import { AviatorPromoBanner } from './aviator-promo-banner'
import { AviatorPromoModal } from './aviator-promo-modal'
import { useBetSlip } from './bet-slip-provider'
import { EventGrid } from './event-grid'
import { SectionHeading } from './section-heading'
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
  simulated?: boolean
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
  error?: string
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

function kickoffLabel(selection: TicketSelection): string {
  const date = new Date(selection.kickoffIso)
  if (Number.isNaN(date.getTime())) return 'Kickoff time unavailable'
  return formatDateTimeLabel(selection.kickoffIso)
}

function statusClass(status: SlipStatus | 'LIVE'): string {
  if (status === 'LIVE') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
  if (status === 'OPEN') return 'border-accent/30 bg-accent/10 text-accent'
  if (status === 'FROZEN') return 'border-amber-700/30 bg-amber-700/10 text-amber-900'
  return 'border-red-700/30 bg-red-700/10 text-red-800'
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

export function ShareLoader({ code }: { code: string }) {
  const router = useRouter()
  const { refreshViewer } = useViewer()
  const { viewer, wallet, walletLoading, setSharedSlip, unlockSlip, openSlip, refreshWallet } =
    useBetSlip()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [count, setCount] = useState(0)
  const [slip, setSlip] = useState<AdminSlip | null>(null)
  const [shareSelections, setShareSelections] = useState<TicketSelection[]>([])
  const [live, setLive] = useState<SharedLiveMatch[]>([])
  const [liveGames, setLiveGames] = useState<BetEvent[]>([])
  const [phone, setPhone] = useState('')
  const [paying, setPaying] = useState(false)
  const [entry, setEntry] = useState<SlipEntry | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [promo, setPromo] = useState<AviatorTrialView | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [ticket, setTicket] = useState<BetTicketView | null>(null)
  const [cashingOut, setCashingOut] = useState(false)
  const [cashoutError, setCashoutError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  const promoStarted = useRef(false)

  const activeClock = slip?.clock ?? null
  const activeMatch = activeClock ? matchClock(activeClock, now) : null

  const simulatedLiveMatches = useMemo<SharedLiveMatch[]>(() => {
    if (!slip || !activeClock) return []
    return slip.selections.flatMap(selection => {
      const clock = selection.simulation ?? activeClock
      const state = matchClock(clock, now)
      if (!state.live) return []
      const teams = teamsFromFixtureLabel(selection.fixtureLabel, selection.fixtureId)
      return [
        {
          fixtureId: selection.fixtureId,
          competition: selection.competition,
          kickoffIso: clock.kickoffIso ?? selection.kickoffIso,
          minute: state.minute,
          label: state.label,
          score: simulatedScore(selection, clock, state.minute),
          ...teams,
          simulated: true,
        },
      ]
    })
  }, [slip, activeClock, now])

  const simulatedLive = simulatedLiveMatches.length > 0
  const liveBadgeLabel = simulatedLiveMatches[0]?.label ?? activeMatch?.label ?? null
  const awaitingSimulatedStart =
    slip?.timeMode === 'SIMULATED' && !slip.liveStartedAt && slip.status !== 'CLOSED'

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    let cancelled = false

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
          setCount(payload.slip.selections.length)
        } else if (payload.share) {
          const selections = payload.share.selections
          const items = selections.map(toSlipItem)
          setShareSelections(selections)
          setSharedSlip(items)
          setCount(items.length)
          setStale(payload.share.stale)
          openSlip()
        }
        setLive(payload.live ?? [])
        setLiveGames(payload.liveGames ?? [])
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
  }, [code, setSharedSlip, openSlip])

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
        if (payload.slip) setSlip(payload.slip)
      } catch {
        return
      }
    }, awaitingSimulatedStart ? 5_000 : 30_000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [code, state, awaitingSimulatedStart])

  useEffect(() => {
    if (!entry || entry.status !== 'PENDING') return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/bet/share/entries/${encodeURIComponent(entry.id)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json().catch(() => ({}))) as { entry?: SlipEntry }
        if (!cancelled && payload.entry) setEntry(payload.entry)
      } catch {
        // keep polling until the provider responds
      }
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [entry])

  useEffect(() => {
    if (!entry || entry.status !== 'PAID') return
    if (promoStarted.current) return

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
  }, [ticket, simulatedLive, slip?.inPlay])

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

  function closePromo() {
    setPromoOpen(false)
    if (!entry) return
    dismissPromo(`spotibet.aviator-promo.${entry.id}`)
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
    if (paying) return
    setPayError(null)

    if (slip && !slip.inPlay && (slip.frozen || slip.status === 'CLOSED' || new Date(slip.autoFreezeAt).getTime() <= Date.now())) {
      setPayError((slip as any).frozenReason || 'Betting is closed for this slip.')
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
        body: JSON.stringify({ code, phone: source === 'wallet' ? '' : cleaned, source }),
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
      if (!response.ok) {
        throw new Error('Sign out failed')
      }
      await refreshViewer()
      router.replace('/bet')
      router.refresh()
    } catch {
      // Keep the signed-in menu state if the sign-out request fails.
    }
  }

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
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

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-white">
        <BrandLoading className="min-h-0 w-full max-w-sm bg-white" message="Loading shared slip" />
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
      <div className="mx-auto max-w-6xl space-y-4">
        <AviatorPromoBanner />
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Share2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold">Shared slip loaded</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-text">
            {count} selection{count === 1 ? '' : 's'} locked into your bet slip. Just set your stake
            and place the bet.
          </p>
          {stale ? (
            <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              One or more prices changed since this slip was shared. Ask the sender for a fresh link.
            </div>
          ) : null}
          {shareSelections.length > 0 ? (
            <ul className="mt-4 space-y-2 text-left">
              {shareSelections.map((selection, index) => (
                <li
                  key={`${selection.fixtureId}:${selection.marketId}:${selection.selectionId}:${index}`}
                  className="rounded-xl border border-border bg-background/40 px-3 py-2"
                >
                  <p className="truncate text-xs font-semibold text-main-text">
                    {selection.fixtureLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-text">
                    <span className="font-semibold text-accent">{selection.marketName}</span> ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·{' '}
                    {selection.selectionLabel}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={openSlip}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
            >
              Enter stake &amp; place bet
            </button>
            <Link
              href="/bet"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
            >
              Back to bet home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const paid = entry?.status === 'PAID'
  const pending = entry?.status === 'PENDING'
  const failed = entry?.status === 'FAILED' || entry?.status === 'CANCELLED'
  const frozen = !slip.inPlay && (slip.frozen || slip.status === 'CLOSED')
  const canPay = !frozen && !paid && !pending
  const signedIn = Boolean(viewer?.userId)
  const walletBalanceMinor = wallet?.balanceMinor ?? 0
  const hasWalletFunds = walletBalanceMinor >= slip.stakeMinor
  const displayOdds = slip.inPlay ? slip.quote.totalOdds : slip.totalOdds
  const displayGross = slip.inPlay ? slip.quote.potentialReturnMinor : slip.potentialReturnMinor
  const displayNet = slip.inPlay ? slip.quote.netPayoutMinor : slip.netPayoutMinor
  const displayVat = slip.inPlay ? slip.quote.vatMinor : slip.vatMinor
  const nextKickoffIso = slip.selections
    .map(selection => selection.kickoffIso)
    .filter((value): value is string => Boolean(value))
    .filter(value => !Number.isNaN(new Date(value).getTime()))
    .filter(value => new Date(value).getTime() > Date.now())
    .sort()[0] ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AviatorPromoBanner />
      {slip.inPlay ? (
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Match has started{liveBadgeLabel ? ` Â· ${liveBadgeLabel}` : ''}. New stakes use live odds.
          </span>
          <Link
            href={`/bet/live?slip=${encodeURIComponent(slip.code)}`}
            className="font-bold underline underline-offset-4 hover:no-underline"
          >
            See live updates â†’
          </Link>
        </div>
      ) : null}
      <section className="mx-auto max-w-2xl">
        <div className="receipt-paper receipt-sheet">
          <div className="px-5 pb-8 pt-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <BrandLogo surface="light" className="h-14 w-auto sm:h-16" />
                <h1 className="mt-1 truncate font-display text-2xl font-bold italic text-main-text">
                  {slip.title ?? 'Shared bet slip'}
                </h1>
                <p className="mt-1 font-mono text-base font-bold tracking-[0.18em] text-accent">{slip.code}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-text">
                  Shared bet receipt
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(value => !value)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls="shared-slip-account-menu"
                    aria-label="Open profile menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/60 text-main-text transition-colors hover:border-accent/40 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  {menuOpen ? (
                    <div
                      id="shared-slip-account-menu"
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-white/95 shadow-2xl backdrop-blur-xl"
                    >
                      {signedIn ? (
                        <>
                          <div className="border-b border-border px-4 py-3">
                            <p className="truncate text-sm font-semibold text-main-text">
                              {viewer?.name?.trim() || viewer?.email || 'Account'}
                            </p>
                            <p className="truncate text-[11px] text-muted-text">{viewer?.email}</p>
                          </div>
                          <nav className="flex flex-col py-1.5">
                            <Link
                              href="/bet/bets"
                              role="menuitem"
                              onClick={() => setMenuOpen(false)}
                              className="px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                            >
                              My bets
                            </Link>
                            <Link
                              href="/bet/account"
                              role="menuitem"
                              onClick={() => setMenuOpen(false)}
                              className="px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                            >
                              Wallet
                            </Link>
                            <Link
                              href="/dashboard"
                              role="menuitem"
                              onClick={() => setMenuOpen(false)}
                              className="px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                            >
                              Dashboard
                            </Link>
                          </nav>
                          <div className="border-t border-border p-1.5">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={handleSignOut}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                            >
                              <LogOut className="h-4 w-4 text-muted-text" />
                              Sign out
                            </button>
                          </div>
                        </>
                      ) : (
                        <nav className="flex flex-col py-1.5">
                          <Link
                            href="/sign-in"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                          >
                            <LogIn className="h-4 w-4 text-accent" />
                            Sign in
                          </Link>
                          <Link
                            href="/sign-up"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                          >
                            <UserPlus className="h-4 w-4 text-accent" />
                            Create account
                          </Link>
                          <Link
                            href="/bet/sports"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                          >
                            Browse sportsbook
                          </Link>
                          <Link
                            href="/bet"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="px-4 py-2.5 text-sm font-medium text-main-text transition-colors hover:bg-white/60"
                          >
                            Back to bet home
                          </Link>
                        </nav>
                      )}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    paid
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : statusClass(slip.inPlay ? 'LIVE' : slip.status)
                  }`}
                >
                  {paid ? 'PAID' : slip.inPlay ? 'LIVE' : slip.status}
                </span>
                {simulatedLive || activeMatch?.live ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                    Live {liveBadgeLabel ?? ''}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/50 px-2.5 py-1 text-[10px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:bg-white/70 hover:text-main-text"
                >
                  {copied ? (
                    <CircleCheck className="h-3 w-3 text-accent" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Share'}
                </button>
              </div>
            </div>

            <div className="receipt-rule my-4" />

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

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-white/50 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-main-text">
                  {formatTzs(slip.stakeMinor)}
                </p>
              </div>
              <div className="rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</p>
                <p className="mt-0.5 font-mono text-sm font-black tabular-nums text-accent">
                  {formatOdds(displayOdds)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white/50 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">
                  {slip.inPlay ? 'Live return' : 'Gross return'}
                </p>
                <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-main-text">
                  {formatTzs(displayGross)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-text">Net payout</p>
                <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-black">
                  {formatTzs(displayNet)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-text">
              Includes {formatTzs(displayVat)} VAT (10%) deducted from the gross return.
            </p>
            {slip.inPlay ? (
              <p className="mt-1 text-center text-[10px] font-semibold text-emerald-700">
                Live prices are reduced as the match progresses. A stake placed now settles at
                these odds.
              </p>
            ) : null}

            {simulatedLiveMatches.length > 0 ? (
              <div className="receipt-rule mt-4 pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                    Live matches
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-muted-text">
                    {simulatedLiveMatches.length} in play
                  </span>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {simulatedLiveMatches.map(match => (
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
                        <span className="shrink-0 rounded-md bg-white/60 px-2 py-1 font-mono text-sm font-bold tabular-nums text-main-text">
                          {match.score ? `${match.score.home} - ${match.score.away}` : 'vs'}
                        </span>
                        <div className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-[11px] font-semibold text-main-text">
                            {match.away.name}
                          </span>
                          <TeamBadge team={match.away} size="xs" />
                        </div>
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-semibold text-red-700">
                        {match.label ?? activeMatch?.label ?? (match.minute ? `${match.minute}'` : 'In play')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {live.length > 0 ? (
              <div className="receipt-rule mt-4 pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                    Live now
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-muted-text">
                    {live.length} in play
                  </span>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {live.map(match => (
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
                        <span className="shrink-0 rounded-md bg-white/60 px-2 py-1 font-mono text-sm font-bold tabular-nums text-main-text">
                          {match.score ? `${match.score.home} - ${match.score.away}` : 'vs'}
                        </span>
                        <div className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-[11px] font-semibold text-main-text">
                            {match.away.name}
                          </span>
                          <TeamBadge team={match.away} size="xs" />
                        </div>
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-semibold text-red-700">
                        {match.label ?? activeMatch?.label ?? (match.minute ? `${match.minute}'` : 'In play')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="receipt-rule mt-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-main-text">Selections</h2>
                <span className="text-[11px] text-muted-text">One result per match</span>
              </div>

              <ul className="mt-3 space-y-2">
                {slip.selections.map((selection, index) => {
                  const selectionClock = selection.simulation ?? activeClock
                  const selectionLive = selectionClock
                    ? matchClock(selectionClock, now).live
                    : slip.inPlay
                  return (
                    <li
                      key={`${selection.fixtureId}:${selection.marketId}:${selection.selectionId}:${index}`}
                      className="receipt-item flex items-stretch gap-3 border-emerald-600/20 bg-emerald-50/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full border border-emerald-600/25 bg-emerald-100 text-[11px] font-bold tabular-nums text-emerald-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-main-text">
                          {selection.fixtureLabel}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-text">
                          {selection.competition}
                        </p>
                        {selectionLive ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            In play Â· {formatOdds(selection.baseOdds ?? selection.odds)} â†’{' '}
                            {formatOdds(selection.odds)}
                          </p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span className="font-semibold text-accent">{selection.marketName}</span>
                          <span className="text-muted-text">{selection.selectionLabel}</span>
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-muted-text">
                          <Clock className="h-3 w-3" />
                          {kickoffLabel(selection)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-600/35 bg-emerald-100 px-3 py-1.5 text-center">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                          Odds
                        </span>
                        <span className="font-mono text-base font-black tabular-nums text-emerald-700">
                          {formatOdds(selection.odds)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {frozen ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-700/25 bg-amber-700/10 px-3 py-2 text-xs text-amber-900">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Betting is closed for this slip.</span>
                </div>
              ) : null}
            </div>

            <div className="receipt-rule mt-5 pt-5">
              {paid ? (
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                    <CircleCheck className="h-6 w-6" />
                  </div>
                  <h2 className="mt-3 font-display text-xl font-semibold">Bet confirmed</h2>
                  <p className="mt-1 text-sm text-muted-text">{entry?.message}</p>
                  {entry?.ticketCode ? (
                    <div className="mx-auto mt-4 max-w-xs rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-main-text">
                      <p className="text-[10px] uppercase tracking-wide text-muted-text">
                        Ticket code
                      </p>
                      <p className="font-mono text-base font-bold tracking-[0.18em] text-accent">
                        {entry.ticketCode}
                      </p>
                    </div>
                   ) : null}
                    {entry.ticketId && (ticket?.status === 'OPEN' || ticket?.status === 'CASHED_OUT') ? (
                     <div className="mx-auto mt-4 max-w-sm rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-center">
                       <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                         Cash-out offer
                       </p>
                       <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-700">
                         {formatTzs(ticket?.cashoutOfferMinor ?? 0)}
                       </p>
                       {ticket?.status === 'CASHED_OUT' ? (
                         <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                           Cashed out for {formatTzs(ticket.payoutMinor)}
                         </p>
                       ) : ticket?.cashoutOfferMinor != null ? (
                         <button
                           type="button"
                           onClick={cashout}
                           disabled={cashingOut}
                           className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                         >
                           {cashingOut ? (
                             <Loader2 className="h-3.5 w-3.5 animate-spin" />
                           ) : (
                             <Banknote className="h-3.5 w-3.5" />
                           )}
                           Cash out now
                         </button>
                       ) : (
                          <p className="mt-1 text-[10px] text-muted-text">
                            Cash-out offer recalculates as the match progresses.
                          </p>
                       )}
                       {cashoutError ? (
                         <p className="mt-1 text-[10px] text-red-700">{cashoutError}</p>
                       ) : null}
                     </div>
                    ) : null}
                    {ticket && (ticket.status === 'WON' || ticket.status === 'LOST' || ticket.status === 'VOID') ? (
                      <div
                        className={`mx-auto mt-4 max-w-sm rounded-xl border px-3 py-2.5 text-center text-xs ${
                          ticket.status === 'WON'
                            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-800'
                            : 'border-border bg-background/40 text-muted-text'
                        }`}
                      >
                        {ticket.status === 'WON'
                          ? `You won ${formatTzs(ticket.payoutMinor)}. The payout is in your wallet.`
                          : ticket.status === 'LOST'
                            ? 'This ticket did not win.'
                            : 'This ticket was voided and returned to your wallet.'}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">

                     <Link
                       href="/bet/bets"

                      className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
                    >
                      View my bets
                    </Link>
                    <Link
                      href="/bet/sports"
                      className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
                    >
                      Keep browsing
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  {signedIn ? (
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                        <WalletCards className="h-4 w-4 text-accent" />
                        Pay from wallet
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-text">
                        Your bet is placed instantly and winnings return to your wallet.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-text">
                            Balance
                          </p>
                          <p className="mt-0.5 font-mono text-sm font-bold text-main-text">
                            {walletLoading && !wallet ? 'â€¦' : formatTzs(walletBalanceMinor)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
                          <p className="mt-0.5 font-mono text-sm font-bold text-main-text">
                            {formatTzs(slip.stakeMinor)}
                          </p>
                        </div>
                      </div>
                      {!hasWalletFunds && !walletLoading ? (
                        <div className="mt-3 rounded-xl border border-amber-700/25 bg-amber-700/10 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                          Add funds to your wallet to take this slip.{' '}
                          <Link href="/bet/deposit" className="font-bold underline underline-offset-2">
                            Add funds
                          </Link>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startPayment('wallet')}
                        disabled={!canPay || paying || frozen || !hasWalletFunds || walletLoading || !wallet}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {paying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <WalletCards className="h-4 w-4" />
                        )}
                        {paying
                          ? 'Placing bet...'
                          : `Place bet Â· ${formatTzs(slip.stakeMinor)}`}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                        <Smartphone className="h-4 w-4 text-accent" />
                        Confirm and pay
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-text">
                        Enter the mobile-money number. You will get a prompt to approve the payment,
                        then the bet is placed automatically.
                      </p>
                      <div className="mt-4 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-[11px] leading-relaxed text-accent">
                        You can take this slip as a guest. Create an account to keep your bets and
                        withdraw winnings.
                      </div>
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
                          className="w-full rounded-xl border border-border bg-white/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60 disabled:opacity-60"
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
                        onClick={() => startPayment('phone')}
                        disabled={!canPay || paying || frozen}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {paying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Smartphone className="h-4 w-4" />
                        )}
                        {paying ? 'Starting payment...' : `Pay ${formatTzs(slip.stakeMinor)}`}
                      </button>
                    </div>
                  )}

                  {failed ? (
                    <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-red-700/25 bg-red-700/10 px-3 py-2 text-xs text-red-800">
                      <CircleAlert className="h-4 w-4" />
                      {entry?.message ?? 'The bet could not be placed. You can try again.'}
                    </p>
                  ) : null}

                  {payError ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-700">
                      <CircleAlert className="h-3.5 w-3.5" />
                      {payError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="receipt-rule mt-5" />
            <div className="pb-1 pt-3 text-center">
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
                        : 'Ready to play'}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-text">
                SpotibetBet ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· EAT ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {slip.code}
              </p>
            </div>
          </div>
          <span aria-hidden className="receipt-tear" />
        </div>
      </section>

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




