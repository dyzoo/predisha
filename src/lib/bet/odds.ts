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

const PREDICTION_MARKET_ORDER: BetMarketId[] = [
  '1x2',
  'double-chance',
  'total-goals',
  'btts',
]

const MARKET_NAMES: Record<BetMarketId, string> = {
  '1x2': 'Match result',
  'double-chance': 'Double chance',
  'total-goals': 'Total goals',
  goals: 'Goals',
  btts: 'Both teams to score',
  'total-corners': 'Total corners',
  'shots-on-target': 'Shots on target',
  'substitutions-2h': 'Substitutions 2nd half',
  'yellow-cards-1h': 'Yellow cards 1st half',
  'red-card': 'Red card',
  'goalkeeper-score': 'Goalkeeper to score',
  'first-goal': 'First goal time',
  'goals-0-5': 'Goals 0-5',
}

interface StaticSelectionSpec {
  selectionId: string
  label: string
  shortLabel: string
  probability: number
}

interface StaticMarketSpec {
  id: BetMarketId
  selections: StaticSelectionSpec[]
}

const STATIC_MARKETS: StaticMarketSpec[] = [
  {
    id: 'goals',
    selections: [
      { selectionId: 'GOALS_OVER_0_5', label: 'Over 0.5 goals', shortLabel: 'O0.5', probability: 0.88 },
      { selectionId: 'GOALS_UNDER_3_5', label: 'Under 3.5 goals', shortLabel: 'U3.5', probability: 0.58 },
    ],
  },
  {
    id: 'total-corners',
    selections: [
      { selectionId: 'CORNERS_OVER_3_5', label: 'Over 3.5 corners', shortLabel: 'O3.5', probability: 0.55 },
      { selectionId: 'CORNERS_UNDER_25_5', label: 'Under 25.5 corners', shortLabel: 'U25.5', probability: 0.78 },
    ],
  },
  {
    id: 'shots-on-target',
    selections: [
      { selectionId: 'SOT_OVER_3_5', label: 'Over 3.5 shots on target', shortLabel: 'O3.5', probability: 0.6 },
      { selectionId: 'SOT_UNDER_25_5', label: 'Under 25.5 shots on target', shortLabel: 'U25.5', probability: 0.82 },
    ],
  },
  {
    id: 'substitutions-2h',
    selections: [
      { selectionId: 'SUBS_2H_OVER_0_5', label: 'Over 0.5 substitutions', shortLabel: 'O0.5', probability: 0.55 },
      { selectionId: 'SUBS_2H_UNDER_3_5', label: 'Under 3.5 substitutions', shortLabel: 'U3.5', probability: 0.8 },
    ],
  },
  {
    id: 'yellow-cards-1h',
    selections: [
      { selectionId: 'YC1H_OVER_0_5', label: 'Over 0.5 yellow cards', shortLabel: 'O0.5', probability: 0.62 },
      { selectionId: 'YC1H_UNDER_6_5', label: 'Under 6.5 yellow cards', shortLabel: 'U6.5', probability: 0.85 },
    ],
  },
  {
    id: 'red-card',
    selections: [
      { selectionId: 'RED_YES', label: 'Red card: Yes', shortLabel: 'Yes', probability: 0.18 },
      { selectionId: 'RED_NO', label: 'Red card: No', shortLabel: 'No', probability: 0.82 },
    ],
  },
  {
    id: 'goalkeeper-score',
    selections: [
      { selectionId: 'GK_SCORE_YES', label: 'Goalkeeper to score: Yes', shortLabel: 'Yes', probability: 0.03 },
      { selectionId: 'GK_SCORE_NO', label: 'Goalkeeper to score: No', shortLabel: 'No', probability: 0.97 },
    ],
  },
  {
    id: 'first-goal',
    selections: [
      { selectionId: 'FIRST_GOAL_1_30', label: 'First goal in 1-30', shortLabel: '1-30', probability: 0.62 },
      { selectionId: 'FIRST_GOAL_31_60', label: 'First goal in 31-60', shortLabel: '31-60', probability: 0.25 },
      { selectionId: 'FIRST_GOAL_61_90', label: 'First goal in 61-90', shortLabel: '61-90', probability: 0.13 },
    ],
  },
  {
    id: 'goals-0-5',
    selections: [
      { selectionId: 'GOALS05_HOME', label: '0-5 goals: Home', shortLabel: 'Home', probability: 0.36 },
      { selectionId: 'GOALS05_DRAW', label: '0-5 goals: Draw', shortLabel: 'Draw', probability: 0.26 },
      { selectionId: 'GOALS05_AWAY', label: '0-5 goals: Away', shortLabel: 'Away', probability: 0.22 },
    ],
  },
]

export function oddsForProbability(probability: number, margin = BOOK_MARGIN): number {
  const safeProbability = Math.min(0.999, Math.max(0.001, probability))
  const raw = 1 / (safeProbability * (1 + margin))
  return Math.max(1.01, Math.round(raw * 100) / 100)
}

const NON_GOAL_THRESHOLD_PREFIXES = ['CORNERS_', 'SOT_', 'SUBS_2H_', 'YC1H_']

function goalsThresholdFor(selectionId: string): { over: boolean; line: number } | null {
  if (NON_GOAL_THRESHOLD_PREFIXES.some(prefix => selectionId.toUpperCase().startsWith(prefix))) {
    return null
  }
  const normalized = selectionId.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const match =
    normalized.match(/(?:^|_)GOALS_(OVER|UNDER)_(\d+)_(\d+)$/) ??
    normalized.match(/(?:^|_)(OVER|UNDER)_(\d+)_(\d+)$/)
  if (!match) return null
  return {
    over: match[1] === 'OVER',
    line: Number(`${match[2]}.${match[3]}`),
  }
}

function marketIdFor(option: MarketOption): BetMarketId | null {
  return MARKET_IDS[option.market] ?? null
}

export function marketIdForOutcomeKey(key: string): BetMarketId | null {
  if (key === 'HOME' || key === 'DRAW' || key === 'AWAY') return '1x2'
  if (key.startsWith('DC_')) return 'double-chance'
  if (key.startsWith('OVER_') || key.startsWith('UNDER_')) return 'total-goals'
  if (key.startsWith('BTTS_')) return 'btts'
  return null
}

export function marketNameForId(id: BetMarketId): string {
  return MARKET_NAMES[id]
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

  const predictionMarkets = PREDICTION_MARKET_ORDER.flatMap(id => {
    const market = groups.get(id)
    return market ? [market] : []
  })

  const staticMarkets: BetMarket[] = STATIC_MARKETS.map(spec => ({
    id: spec.id,
    name: MARKET_NAMES[spec.id],
    selections: spec.selections.map(selection => ({
      id: `${spec.id}:${selection.selectionId}`,
      marketId: spec.id,
      marketName: MARKET_NAMES[spec.id],
      selectionId: selection.selectionId,
      label: selection.label,
      shortLabel: selection.shortLabel,
      probability: selection.probability,
      odds: oddsForProbability(selection.probability),
      simulated: true,
    })),
  }))

  return [...predictionMarkets, ...staticMarkets]
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
  return Object.prototype.hasOwnProperty.call(MARKET_NAMES, value)
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

  if (selectionId === 'CORNERS_OVER_3_5' || selectionId === 'CORNERS_UNDER_25_5') {
    const corners = (homeScore * 7 + awayScore * 11) % 26
    return selectionId === 'CORNERS_OVER_3_5' ? corners > 3.5 : corners < 25.5
  }
  if (selectionId === 'SOT_OVER_3_5' || selectionId === 'SOT_UNDER_25_5') {
    const shots = (homeScore * 5 + awayScore * 7 + 4) % 28
    return selectionId === 'SOT_OVER_3_5' ? shots > 3.5 : shots < 25.5
  }
  if (selectionId === 'SUBS_2H_OVER_0_5' || selectionId === 'SUBS_2H_UNDER_3_5') {
    const substitutions = (homeScore * 2 + awayScore * 3) % 5
    return selectionId === 'SUBS_2H_OVER_0_5'
      ? substitutions > 0.5
      : substitutions < 3.5
  }
  if (selectionId === 'YC1H_OVER_0_5' || selectionId === 'YC1H_UNDER_6_5') {
    const yellowCards = (homeScore * 2 + awayScore * 3 + 1) % 7
    return selectionId === 'YC1H_OVER_0_5' ? yellowCards > 0.5 : yellowCards < 6.5
  }
  if (selectionId === 'RED_YES' || selectionId === 'RED_NO') {
    const redCard = (homeScore * 3 + awayScore) % 7 === 0
    return selectionId === 'RED_YES' ? redCard : !redCard
  }
  if (selectionId === 'GK_SCORE_YES' || selectionId === 'GK_SCORE_NO') {
    const keeperScores =
      totalGoals > 0 && (homeScore * 5 + awayScore * 7) % 37 === 0
    return selectionId === 'GK_SCORE_YES' ? keeperScores : !keeperScores
  }
  if (selectionId.startsWith('FIRST_GOAL_')) {
    if (totalGoals === 0) return false
    const minute = ((homeScore * 13 + awayScore * 17) % 90) + 1
    if (selectionId === 'FIRST_GOAL_1_30') return minute <= 30
    if (selectionId === 'FIRST_GOAL_31_60') return minute > 30 && minute <= 60
    if (selectionId === 'FIRST_GOAL_61_90') return minute > 60
    return null
  }
  if (selectionId.startsWith('GOALS05_')) {
    if (totalGoals > 5) return false
    const outcome = outcomeForScore(homeScore, awayScore)
    if (selectionId === 'GOALS05_HOME') return outcome === 'HOME'
    if (selectionId === 'GOALS05_DRAW') return outcome === 'DRAW'
    if (selectionId === 'GOALS05_AWAY') return outcome === 'AWAY'
    return null
  }

  const goalsThreshold = goalsThresholdFor(selectionId)
  if (goalsThreshold) {
    return goalsThreshold.over
      ? totalGoals > goalsThreshold.line
      : totalGoals < goalsThreshold.line
  }

  return null
}
