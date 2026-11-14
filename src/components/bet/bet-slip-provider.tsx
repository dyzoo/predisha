'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ClientViewer } from '@/lib/auth/entitlements'
import type { BetSlipItem, BetTicketView, BetWalletView } from '@/lib/bet/types'
import { MAX_SELECTIONS, MIN_STAKE_MINOR } from '@/lib/bet/types'

const STORAGE_KEY = 'predisha.bet.slip.v1'
const DEFAULT_STAKE = 1_000

interface PlaceBetResult {
  ok: boolean
  error?: string
  code?: string
  ticket?: BetTicketView
}

interface BetSlipContextValue {
  viewer: ClientViewer
  items: BetSlipItem[]
  stakeMinor: number
  setStakeMinor: (value: number) => void
  addSelection: (item: BetSlipItem) => void
  removeSelection: (key: string) => void
  toggleSelection: (item: BetSlipItem) => void
  setItemsFromShare: (items: BetSlipItem[]) => void
  clear: () => void
  hasSelection: (key: string) => boolean
  totalOdds: number
  potentialReturnMinor: number
  wallet: BetWalletView | null
  walletLoading: boolean
  refreshWallet: () => Promise<void>
  placeBet: () => Promise<PlaceBetResult>
  placing: boolean
  slipOpen: boolean
  openSlip: () => void
  closeSlip: () => void
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null)

function isSlipItem(value: unknown): value is BetSlipItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.key === 'string' &&
    typeof record.fixtureId === 'string' &&
    typeof record.marketId === 'string' &&
    typeof record.selectionId === 'string' &&
    typeof record.odds === 'number' &&
    Number.isFinite(record.odds) &&
    typeof record.fixtureLabel === 'string' &&
    typeof record.competition === 'string' &&
    typeof record.marketName === 'string' &&
    typeof record.selectionLabel === 'string' &&
    typeof record.kickoffIso === 'string'
  )
}

function normalizeItems(value: unknown): BetSlipItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isSlipItem).slice(0, MAX_SELECTIONS)
}

export function BetSlipProvider({
  viewer,
  children,
}: {
  viewer: ClientViewer
  children: ReactNode
}) {
  const [items, setItems] = useState<BetSlipItem[]>([])
  const [stakeMinor, setStakeMinorState] = useState(DEFAULT_STAKE)
  const [hydrated, setHydrated] = useState(false)
  const [wallet, setWallet] = useState<BetWalletView | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: unknown; stakeMinor?: unknown }
        // Hydrating from localStorage is the intended client-only initialisation.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(normalizeItems(parsed.items))
        if (
          typeof parsed.stakeMinor === 'number' &&
          Number.isInteger(parsed.stakeMinor) &&
          parsed.stakeMinor >= MIN_STAKE_MINOR
        ) {
          setStakeMinorState(parsed.stakeMinor)
        }
      }
    } catch {
      // Ignore malformed local storage.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, stakeMinor }))
    } catch {
      // Storage may be unavailable in private mode.
    }
  }, [items, stakeMinor, hydrated])

  const refreshWallet = useCallback(async () => {
    if (!viewer.userId) {
      setWallet(null)
      return
    }
    setWalletLoading(true)
    try {
      const response = await fetch('/api/bet/wallet', { cache: 'no-store' })
      if (response.ok) {
        const payload = (await response.json()) as { wallet?: BetWalletView }
        setWallet(payload.wallet ?? null)
      }
    } catch {
      // Keep the previous balance; the next refresh can retry.
    } finally {
      setWalletLoading(false)
    }
  }, [viewer.userId])

  useEffect(() => {
    let cancelled = false

    async function loadWallet() {
      if (!viewer.userId) {
        if (!cancelled) setWallet(null)
        return
      }
      setWalletLoading(true)
      try {
        const response = await fetch('/api/bet/wallet', { cache: 'no-store' })
        if (cancelled) return
        if (response.ok) {
          const payload = (await response.json()) as { wallet?: BetWalletView }
          setWallet(payload.wallet ?? null)
        }
      } catch {
        // Keep the previous balance; a manual refresh can retry.
      } finally {
        if (!cancelled) setWalletLoading(false)
      }
    }

    void loadWallet()
    return () => {
      cancelled = true
    }
  }, [viewer.userId])

  const addSelection = useCallback((item: BetSlipItem) => {
    setItems(current => {
      const withoutMarket = current.filter(
        existing => !(existing.fixtureId === item.fixtureId && existing.marketId === item.marketId),
      )
      if (withoutMarket.length >= MAX_SELECTIONS) return current
      return [...withoutMarket, item]
    })
  }, [])

  const removeSelection = useCallback((key: string) => {
    setItems(current => current.filter(item => item.key !== key))
  }, [])

  const toggleSelection = useCallback((item: BetSlipItem) => {
    setItems(current => {
      const existing = current.find(candidate => candidate.key === item.key)
      if (existing) return current.filter(candidate => candidate.key !== item.key)
      const withoutMarket = current.filter(
        candidate => !(candidate.fixtureId === item.fixtureId && candidate.marketId === item.marketId),
      )
      if (withoutMarket.length >= MAX_SELECTIONS) return current
      return [...withoutMarket, item]
    })
  }, [])

  const setItemsFromShare = useCallback((incoming: BetSlipItem[]) => {
    setItems(current => {
      const next = [...current]
      for (const item of incoming.slice(0, MAX_SELECTIONS)) {
        const index = next.findIndex(
          existing => existing.fixtureId === item.fixtureId && existing.marketId === item.marketId,
        )
        if (index >= 0) next[index] = item
        else if (next.length < MAX_SELECTIONS) next.push(item)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setItems([]), [])
  const openSlip = useCallback(() => setSlipOpen(true), [])
  const closeSlip = useCallback(() => setSlipOpen(false), [])

  const setStakeMinor = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    const rounded = Math.max(MIN_STAKE_MINOR, Math.round(value))
    setStakeMinorState(rounded)
  }, [])

  const hasSelection = useCallback(
    (key: string) => items.some(item => item.key === key),
    [items],
  )

  const totalOdds = useMemo(() => {
    const product = items.reduce((total, item) => total * item.odds, 1)
    return Math.max(1, Math.round(product * 100) / 100)
  }, [items])

  const potentialReturnMinor = useMemo(
    () => Math.floor(stakeMinor * totalOdds),
    [stakeMinor, totalOdds],
  )

  const placeBet = useCallback(async (): Promise<PlaceBetResult> => {
    if (!viewer.userId) {
      return { ok: false, code: 'AUTH_REQUIRED', error: 'Sign in to place a bet.' }
    }
    if (items.length === 0) {
      return { ok: false, code: 'EMPTY_SLIP', error: 'Add at least one selection.' }
    }
    if (stakeMinor < MIN_STAKE_MINOR) {
      return { ok: false, code: 'BAD_STAKE', error: 'Stake is below the minimum.' }
    }

    setPlacing(true)
    try {
      const response = await fetch('/api/bet/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeMinor,
          selections: items.map(item => ({
            fixtureId: item.fixtureId,
            marketId: item.marketId,
            selectionId: item.selectionId,
            odds: item.odds,
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        code?: string
        ticket?: BetTicketView
      }
      if (!response.ok) {
        return {
          ok: false,
          code: payload.code,
          error: payload.error ?? 'Could not place the bet.',
        }
      }
      setItems([])
      await refreshWallet()
      return { ok: true, ticket: payload.ticket }
    } catch {
      return { ok: false, code: 'NETWORK', error: 'Network error. Please try again.' }
    } finally {
      setPlacing(false)
    }
  }, [items, refreshWallet, stakeMinor, viewer.userId])

  const value = useMemo<BetSlipContextValue>(
    () => ({
      viewer,
      items,
      stakeMinor,
      setStakeMinor,
      addSelection,
      removeSelection,
      toggleSelection,
      setItemsFromShare,
      clear,
      hasSelection,
      totalOdds,
      potentialReturnMinor,
      wallet,
      walletLoading,
      refreshWallet,
      placeBet,
      placing,
      slipOpen,
      openSlip,
      closeSlip,
    }),
    [
      viewer,
      items,
      stakeMinor,
      setStakeMinor,
      addSelection,
      removeSelection,
      toggleSelection,
      setItemsFromShare,
      clear,
      hasSelection,
      totalOdds,
      potentialReturnMinor,
      wallet,
      walletLoading,
      refreshWallet,
      placeBet,
      placing,
      slipOpen,
      openSlip,
      closeSlip,
    ],
  )

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>
}

export function useBetSlip(): BetSlipContextValue {
  const context = useContext(BetSlipContext)
  if (!context) throw new Error('useBetSlip must be used inside BetSlipProvider')
  return context
}
