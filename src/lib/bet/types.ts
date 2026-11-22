import type { FixtureStatus } from '@/lib/sports/provider'
import type { BetMode } from './mode-copy'

export const BET_CURRENCY = 'TZS'
export const BOOK_MARGIN = 0.06
export const MIN_STAKE_MINOR = 500
export const MAX_STAKE_MINOR = 500_000
export const MIN_DEPOSIT_MINOR = 5_000
export const MAX_DEPOSIT_MINOR = 1_000_000
export const MIN_WITHDRAW_MINOR = 1_000
export const MAX_SELECTIONS = 20
export const SHARE_CODE_HOURS = 24
export const SLIP_QUICK_STAKES = [30_000, 60_000, 100_000, 200_000]

export function slipStakeOptions(minimum: number): number[] {
  const floor = Number.isFinite(minimum) ? Math.max(MIN_STAKE_MINOR, Math.round(minimum)) : MIN_STAKE_MINOR
  const presets = SLIP_QUICK_STAKES.filter(
    amount => amount >= floor && amount <= MAX_STAKE_MINOR,
  )
  if (presets.length > 0) return presets
  return floor <= MAX_STAKE_MINOR ? [floor] : []
}

export type BetMarketId =
  | '1x2'
  | 'double-chance'
  | 'total-goals'
  | 'goals'
  | 'btts'
  | 'total-corners'
  | 'shots-on-target'
  | 'substitutions-2h'
  | 'yellow-cards-1h'
  | 'red-card'
  | 'goalkeeper-score'
  | 'first-goal'
  | 'goals-0-5'
  | 'ht-ft'
  | '1h-1x2'
  | '2h-1x2'
  | '1h-totals'
  | '2h-totals'
  | 'correct-score'
  | 'odd-even-goals'
  | 'both-halves-win'
  | 'score-both-halves'
  | 'win-to-nil'
  | 'clean-sheet'
  | 'handicap-2way'
  | 'handicap-3way'
  | 'total-goals-extra'

export type BetMarketGroup = 'popular' | 'goals' | 'halves' | 'special'

export const MARKET_GROUPS: Record<BetMarketId, BetMarketGroup> = {
  '1x2': 'popular',
  'double-chance': 'popular',
  'ht-ft': 'popular',
  'handicap-2way': 'popular',
  'handicap-3way': 'popular',
  'win-to-nil': 'popular',
  'clean-sheet': 'popular',
  'total-goals': 'goals',
  'total-goals-extra': 'goals',
  goals: 'goals',
  btts: 'goals',
  'first-goal': 'goals',
  'correct-score': 'goals',
  'odd-even-goals': 'goals',
  'score-both-halves': 'goals',
  'goals-0-5': 'goals',
  'shots-on-target': 'goals',
  '1h-1x2': 'halves',
  '2h-1x2': 'halves',
  '1h-totals': 'halves',
  '2h-totals': 'halves',
  'both-halves-win': 'halves',
  'total-corners': 'special',
  'substitutions-2h': 'special',
  'yellow-cards-1h': 'special',
  'red-card': 'special',
  'goalkeeper-score': 'special',
}

export function marketGroupForId(id: BetMarketId): BetMarketGroup {
  return MARKET_GROUPS[id]
}

export const EXTRA_MARKET_IDS: BetMarketId[] = [
  'double-chance',
  'total-goals',
  'goals',
  'btts',
  'total-corners',
  'shots-on-target',
  'substitutions-2h',
  'yellow-cards-1h',
  'red-card',
  'goalkeeper-score',
  'first-goal',
  'goals-0-5',
]

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
  minute: number | null
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
export type AdminSlipTimeMode = 'ORIGINAL' | 'MANUAL' | 'SIMULATED'
export type AdminSlipSelectionSource = 'CATALOG' | 'RANDOM'

export interface TicketSimulationMeta {
  liveStartedAt: string
  durationMinutes: number
  seed: string
  kickoffIso: string
}

export function isProviderFixtureId(fixtureId: string): boolean {
  return /^\d+$/.test(fixtureId.trim())
}

export interface LiveScore {
  home: number
  away: number
}

export function formatLiveMinute(minute?: number | null): string | null {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) return null
  const value = Math.max(1, Math.floor(minute))
  if (value === 46) return 'HT'
  if (value <= 45) return `${value}'`
  if (value <= 90) return `${value}'`
  return `90+${value - 90}'`
}

export function liveScoreForSelection(
  selection: Pick<TicketSelection, 'liveScore'>,
  fallback?: LiveScore | null,
): LiveScore | null {
  return selection.liveScore ?? fallback ?? null
}

export function liveMinuteForSelection(
  selection: Pick<TicketSelection, 'liveMinute'>,
  fallback?: number | null,
): number | null {
  return selection.liveMinute ?? fallback ?? null
}

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
  baseOdds?: number
  inPlayFactor?: number
  probability: number
  result: TicketResult
  finalScore: { home: number; away: number } | null
  liveScore?: LiveScore | null
  liveMinute?: number | null
  demoResult: boolean
  simulation?: TicketSimulationMeta | null
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
  cashoutOfferMinor: number | null
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

export interface AviatorPlayerView {
  name: string
  mine: boolean
  stakeMinor: number
  cashedOutAt: number | null
  status: AviatorBetView['status']
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

export interface AviatorPulseView {
  phase: AviatorRoundView['phase']
  multiplier: number
  waitRemainingMs: number
  crashAt: number | null
  history: Array<{ roundId: string; crashAt: number }>
}
