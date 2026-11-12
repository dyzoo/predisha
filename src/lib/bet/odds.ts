import { outcomeForScore, type MarketOption, type PredictionResult } from '@/lib/predictions/engine'
import {
  BOOK_MARGIN,
  type BetEvent,
  type BetMarket,
  type BetMarketId,
  type BetSelectionOption,
} from './types'

const MARKET_IDS: Record<string, BetMarketId> = {
  '1X2': '1x2',
  'Double chance': 'double-chance',
  'Total goals': 'total-goals',
  'Both teams to score': 'btts',
}

const MARKET_ORDER: BetMarketId[] = ['1x2', 'double-chance', 'total-goals', 'btts']

const MARKET_NAMES: Record<BetMarketId, string> = {
  '1x2': 'Match result',
  'double-chance': 'Double chance',
  'total-goals': 'Total goals',
  btts: 'Both teams to score',
}

export function oddsForProbability(probability: number, margin = BOOK_MARGIN): number {
  const safeProbability = Math.min(0.999, Math.max(0.001, probability))
  const raw = 1 / (safeProbability * (1 + margin))
  return Math.max(1.01, Math.round(raw * 100) / 100)
}

function marketIdFor(option: MarketOption): BetMarketId | null {
  return MARKET_IDS[option.market] ?? null
}

export function buildMarkets(prediction: PredictionResult | null): BetMarket[] {
  if (!prediction?.marketOptions?.length) return []

  const groups = new Map<BetMarketId, BetMarket>()
  for (const option of prediction.marketOptions) {
    const marketId = marketIdFor(option)
    if (!marketId) continue
    const existing = groups.get(marketId) ?? {
      id: marketId,
      name: MARKET_NAMES[marketId],
      selections: [],
    }
    const selection: BetSelectionOption = {
      id: `${marketId}:${option.key}`,
      marketId,
      marketName: existing.name,
      selectionId: option.key,
      label: option.label,
      shortLabel: option.shortLabel,
      probability: option.probability,
      odds: oddsForProbability(option.probability),
      simulated: true,
    }
    existing.selections.push(selection)
    groups.set(marketId, existing)
  }

  return MARKET_ORDER.flatMap(id => {
    const market = groups.get(id)
    return market ? [market] : []
  })
}

export function combineOdds(odds: number[]): number {
  const product = odds.reduce((total, value) => total * value, 1)
  return Math.max(1, Math.round(product * 100) / 100)
}

export function findSelection(
  event: BetEvent,
  marketId: string,
  selectionId: string,
): BetSelectionOption | null {
  const market = event.markets.find(item => item.id === marketId)
  if (!market) return null
  return market.selections.find(item => item.selectionId === selectionId) ?? null
}

export function isBetMarketId(value: string): value is BetMarketId {
  return (MARKET_ORDER as string[]).includes(value)
}

export function settleMarket(
  selectionId: string,
  homeScore: number,
  awayScore: number,
): boolean | null {
  const totalGoals = homeScore + awayScore
  if (selectionId === 'HOME' || selectionId === 'DRAW' || selectionId === 'AWAY') {
    return selectionId === outcomeForScore(homeScore, awayScore)
  }
  if (selectionId === 'DC_HOME_DRAW') return homeScore >= awayScore
  if (selectionId === 'DC_DRAW_AWAY') return homeScore <= awayScore
  if (selectionId === 'DC_HOME_AWAY') return homeScore !== awayScore
  if (selectionId === 'OVER_1_5') return totalGoals > 1.5
  if (selectionId === 'OVER_2_5') return totalGoals > 2.5
  if (selectionId === 'UNDER_3_5') return totalGoals < 3.5
  if (selectionId === 'BTTS_YES') return homeScore > 0 && awayScore > 0
  if (selectionId === 'BTTS_NO') return homeScore === 0 || awayScore === 0
  return null
}
