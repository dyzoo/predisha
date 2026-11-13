import type { FixtureStatus } from '@/lib/sports/provider'
import type { BetMode } from './mode-copy'

export const BET_CURRENCY = 'TZS'
export const BOOK_MARGIN = 0.06
export const MIN_STAKE_MINOR = 500
export const MAX_STAKE_MINOR = 500_000
export const MAX_SELECTIONS = 20
export const SHARE_CODE_HOURS = 24

export type BetMarketId = '1x2' | 'double-chance' | 'total-goals' | 'btts'

export interface BetSelectionOption {
  id: string
  marketId: BetMarketId
  marketName: string
  selectionId: string
  label: string
  shortLabel: string
  probability: number
  odds: number
  simulated: true
}

export interface BetMarket {
  id: BetMarketId
  name: string
  selections: BetSelectionOption[]
}

export interface BetEvent {
  id: string
  competition: string
  competitionId: string
  sport: string
  sportId: string
  status: FixtureStatus
  effectiveStatus: FixtureStatus
  live: boolean
  home: { id: string; name: string; short: string; color: string; logoUrl?: string | null }
  away: { id: string; name: string; short: string; color: string; logoUrl?: string | null }
  kickoffIso: string
  kickoffLabel: string
  score: { home: number; away: number } | null
  markets: BetMarket[]
  probability: { home: number; draw: number; away: number } | null
  expectedGoals: { home: number; away: number } | null
  modelVersion: string | null
  simulated: true
  oddsAsOf: string
  sourceLabel: string
}

export interface BetSelectionInput {
  fixtureId: string
  marketId: string
  selectionId: string
  odds: number
}

export interface BetSlipItem extends BetSelectionInput {
  key: string
  fixtureLabel: string
  competition: string
  marketName: string
  selectionLabel: string
  kickoffIso: string
}

export type TicketResult = 'PENDING' | 'WON' | 'LOST' | 'VOID'

export interface TicketSelection {
  fixtureId: string
  fixtureLabel: string
  competition: string
  kickoffIso: string
  kickoffLabel?: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: number
  probability: number
  result: TicketResult
  finalScore: { home: number; away: number } | null
  demoResult: boolean
}

export type BetTicketStatusView = 'OPEN' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT'

export interface BetTicketView {
  id: string
  code: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  status: BetTicketStatusView
  payoutMinor: number
  cashoutMinor: number | null
  selectionCount: number
  selections: TicketSelection[]
  placedAt: string
  settledAt: string | null
  demoEligible: boolean
}

export interface BetTransactionView {
  id: string
  type: string
  amountMinor: number
  balanceAfterMinor: number
  note: string | null
  createdAt: string
}

export interface BetWalletView {
  balanceMinor: number
  currency: typeof BET_CURRENCY
  mode: BetMode
  transactions: BetTransactionView[]
}

export interface BetPromoView {
  id: string
  title: string
  description: string
  bonusMinor: number
  claimed: boolean
  claimedAt: string | null
}

export interface BetGameRoundView {
  id: string
  game: string
  stakeMinor: number
  payoutMinor: number
  status: 'OPEN' | 'WON' | 'LOST'
  detail: Record<string, unknown>
  createdAt: string
  settledAt: string | null
}

export interface AviatorBetView {
  id: string
  roundId: string
  slot: number
  stakeMinor: number
  autoCashout: number | null
  cashedOutAt: number | null
  payoutMinor: number
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST'
}

export interface AviatorRoundView {
  roundId: string
  index: number
  phase: 'WAITING' | 'FLYING' | 'CRASHED'
  multiplier: number
  crashAt: number
  startsAtIso: string
  endsAtIso: string
  waitRemainingMs: number
  flyElapsedMs: number
}
