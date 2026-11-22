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
  'ht-ft': 'Half-time / Full-time',
  '1h-1x2': '1st half 1X2',
  '2h-1x2': '2nd half 1X2',
  '1h-totals': '1st half totals',
  '2h-totals': '2nd half totals',
  'correct-score': 'Correct score',
  'odd-even-goals': 'Odd / even goals',
  'both-halves-win': 'To win both halves',
  'score-both-halves': 'To score in both halves',
  'win-to-nil': 'Win to nil',
  'clean-sheet': 'Clean sheet',
  'handicap-2way': 'Handicap (2-way)',
  'handicap-3way': 'Handicap (3-way)',
  'total-goals-extra': 'Total goals (more lines)',
}

const COMMON_CORRECT_SCORES = [
  { home: 0, away: 0, probability: 0.09 },
  { home: 1, away: 0, probability: 0.12 },
  { home: 0, away: 1, probability: 0.1 },
  { home: 1, away: 1, probability: 0.11 },
  { home: 2, away: 0, probability: 0.08 },
  { home: 0, away: 2, probability: 0.06 },
  { home: 2, away: 1, probability: 0.07 },
  { home: 1, away: 2, probability: 0.06 },
  { home: 2, away: 2, probability: 0.05 },
] as const

const HALF_TOTAL_LINES = [0.5, 1.5, 2.5]
const EXTRA_GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5]

function lineToken(line: number): string {
  return line.toString().replace('.', '_')
}

function halfLineProbability(line: number, over: boolean): number {
  const overProbability = Math.max(0.08, Math.min(0.9, 0.78 - line * 0.22))
  return over ? overProbability : 1 - overProbability
}

function fullLineProbability(line: number, over: boolean): number {
  const overProbability = Math.max(0.05, Math.min(0.9, 0.92 - line * 0.13))
  return over ? overProbability : 1 - overProbability
}

function halfTotalSelections(half: 'H1' | 'H2'): StaticSelectionSpec[] {
  const halfName = half === 'H1' ? '1st' : '2nd'
  return HALF_TOTAL_LINES.flatMap(line => [
    {
      selectionId: `${half}_OVER_${lineToken(line)}`,
      label: `Over ${line} goals in ${halfName} half`,
      shortLabel: `O${line}`,
      probability: halfLineProbability(line, true),
    },
    {
      selectionId: `${half}_UNDER_${lineToken(line)}`,
      label: `Under ${line} goals in ${halfName} half`,
      shortLabel: `U${line}`,
      probability: halfLineProbability(line, false),
    },
  ])
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
  {
    id: 'ht-ft',
    selections: (['HOME', 'DRAW', 'AWAY'] as const).flatMap(ht =>
      (['HOME', 'DRAW', 'AWAY'] as const).map(ft => ({
        selectionId: `HTFT_${ht}_${ft}`,
        label: `${ht[0]}${ht.slice(1).toLowerCase()} / ${ft[0]}${ft.slice(1).toLowerCase()}`,
        shortLabel: `${ht[0]}/${ft[0]}`,
        probability: ht === ft ? 0.12 : ht === 'DRAW' || ft === 'DRAW' ? 0.08 : 0.07,
      })),
    ),
  },
  {
    id: '1h-1x2',
    selections: [
      { selectionId: 'H1_HOME', label: '1st half: Home', shortLabel: 'Home', probability: 0.4 },
      { selectionId: 'H1_DRAW', label: '1st half: Draw', shortLabel: 'Draw', probability: 0.3 },
      { selectionId: 'H1_AWAY', label: '1st half: Away', shortLabel: 'Away', probability: 0.3 },
    ],
  },
  {
    id: '2h-1x2',
    selections: [
      { selectionId: 'H2_HOME', label: '2nd half: Home', shortLabel: 'Home', probability: 0.38 },
      { selectionId: 'H2_DRAW', label: '2nd half: Draw', shortLabel: 'Draw', probability: 0.31 },
      { selectionId: 'H2_AWAY', label: '2nd half: Away', shortLabel: 'Away', probability: 0.31 },
    ],
  },
  {
    id: '1h-totals',
    selections: halfTotalSelections('H1'),
  },
  {
    id: '2h-totals',
    selections: halfTotalSelections('H2'),
  },
  {
    id: 'correct-score',
    selections: [
      ...COMMON_CORRECT_SCORES.map(score => ({
        selectionId: `CORRECT_SCORE_${score.home}_${score.away}`,
        label: `${score.home} - ${score.away}`,
        shortLabel: `${score.home}-${score.away}`,
        probability: score.probability,
      })),
      {
        selectionId: 'CORRECT_SCORE_OTHER',
        label: 'Any other score',
        shortLabel: 'Other',
        probability: 0.26,
      },
    ],
  },
  {
    id: 'odd-even-goals',
    selections: [
      { selectionId: 'GOALS_ODD', label: 'Odd number of goals', shortLabel: 'Odd', probability: 0.55 },
      { selectionId: 'GOALS_EVEN', label: 'Even number of goals', shortLabel: 'Even', probability: 0.45 },
    ],
  },
  {
    id: 'both-halves-win',
    selections: [
      { selectionId: 'WIN_BOTH_HALVES_HOME', label: 'Home to win both halves', shortLabel: 'Home', probability: 0.25 },
      { selectionId: 'WIN_BOTH_HALVES_AWAY', label: 'Away to win both halves', shortLabel: 'Away', probability: 0.2 },
      { selectionId: 'WIN_BOTH_HALVES_NO', label: 'Neither', shortLabel: 'No', probability: 0.55 },
    ],
  },
  {
    id: 'score-both-halves',
    selections: [
      { selectionId: 'SCORE_BOTH_HALVES_HOME', label: 'Home to score in both halves', shortLabel: 'Home', probability: 0.3 },
      { selectionId: 'SCORE_BOTH_HALVES_AWAY', label: 'Away to score in both halves', shortLabel: 'Away', probability: 0.25 },
      { selectionId: 'SCORE_BOTH_HALVES_NO', label: 'Neither', shortLabel: 'No', probability: 0.45 },
    ],
  },
  {
    id: 'win-to-nil',
    selections: [
      { selectionId: 'WIN_TO_NIL_HOME', label: 'Home to win to nil', shortLabel: 'Home', probability: 0.22 },
      { selectionId: 'WIN_TO_NIL_AWAY', label: 'Away to win to nil', shortLabel: 'Away', probability: 0.18 },
      { selectionId: 'WIN_TO_NIL_NO', label: 'Neither', shortLabel: 'No', probability: 0.6 },
    ],
  },
  {
    id: 'clean-sheet',
    selections: [
      { selectionId: 'CLEAN_SHEET_HOME_YES', label: 'Home clean sheet: Yes', shortLabel: 'H Yes', probability: 0.35 },
      { selectionId: 'CLEAN_SHEET_HOME_NO', label: 'Home clean sheet: No', shortLabel: 'H No', probability: 0.65 },
      { selectionId: 'CLEAN_SHEET_AWAY_YES', label: 'Away clean sheet: Yes', shortLabel: 'A Yes', probability: 0.32 },
      { selectionId: 'CLEAN_SHEET_AWAY_NO', label: 'Away clean sheet: No', shortLabel: 'A No', probability: 0.68 },
    ],
  },
  {
    id: 'handicap-2way',
    selections: [
      { selectionId: 'HCP2_HOME_MINUS_1_5', label: 'Home -1.5', shortLabel: 'H -1.5', probability: 0.48 },
      { selectionId: 'HCP2_AWAY_PLUS_1_5', label: 'Away +1.5', shortLabel: 'A +1.5', probability: 0.52 },
      { selectionId: 'HCP2_HOME_PLUS_1_5', label: 'Home +1.5', shortLabel: 'H +1.5', probability: 0.78 },
      { selectionId: 'HCP2_AWAY_MINUS_1_5', label: 'Away -1.5', shortLabel: 'A -1.5', probability: 0.22 },
    ],
  },
  {
    id: 'handicap-3way',
    selections: [
      { selectionId: 'HCP3_HOME_MINUS_1', label: 'Home -1', shortLabel: 'H -1', probability: 0.3 },
      { selectionId: 'HCP3_DRAW_MINUS_1', label: 'Draw (Home -1)', shortLabel: 'Draw', probability: 0.25 },
      { selectionId: 'HCP3_AWAY_MINUS_1', label: 'Away (+1)', shortLabel: 'A +1', probability: 0.45 },
    ],
  },
  {
    id: 'total-goals-extra',
    selections: EXTRA_GOAL_LINES.flatMap(line => [
      {
        selectionId: `GOALS_EXTRA_OVER_${lineToken(line)}`,
        label: `Over ${line} goals`,
        shortLabel: `O${line}`,
        probability: fullLineProbability(line, true),
      },
      {
        selectionId: `GOALS_EXTRA_UNDER_${lineToken(line)}`,
        label: `Under ${line} goals`,
        shortLabel: `U${line}`,
        probability: fullLineProbability(line, false),
      },
    ]),
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
    normalized.match(/(?:^|_)GOALS_EXTRA_(OVER|UNDER)_(\d+)_(\d+)$/) ??
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

export interface MarketSettlementContext {
  halfTimeHomeScore?: number | null
  halfTimeAwayScore?: number | null
  goalOrder?: Array<'HOME' | 'AWAY'>
}

function halfScoreSplit(
  homeScore: number,
  awayScore: number,
  context: MarketSettlementContext,
): {
  first: { home: number; away: number }
  second: { home: number; away: number }
} {
  if (
    typeof context.halfTimeHomeScore === 'number' &&
    typeof context.halfTimeAwayScore === 'number' &&
    Number.isFinite(context.halfTimeHomeScore) &&
    Number.isFinite(context.halfTimeAwayScore)
  ) {
    const firstHome = Math.max(0, Math.min(homeScore, Math.floor(context.halfTimeHomeScore)))
    const firstAway = Math.max(0, Math.min(awayScore, Math.floor(context.halfTimeAwayScore)))
    return {
      first: { home: firstHome, away: firstAway },
      second: { home: homeScore - firstHome, away: awayScore - firstAway },
    }
  }

  const firstHome = Math.ceil(homeScore / 2)
  const firstAway = Math.ceil(awayScore / 2)
  return {
    first: { home: firstHome, away: firstAway },
    second: { home: homeScore - firstHome, away: awayScore - firstAway },
  }
}

function goalOrder(homeScore: number, awayScore: number): Array<'HOME' | 'AWAY'> {
  const order: Array<'HOME' | 'AWAY'> = []
  let homeRemaining = Math.max(0, homeScore)
  let awayRemaining = Math.max(0, awayScore)
  let homeTurn = (homeScore + awayScore) % 2 === 0
  while (homeRemaining > 0 || awayRemaining > 0) {
    if ((homeTurn && homeRemaining > 0) || awayRemaining === 0) {
      order.push('HOME')
      homeRemaining -= 1
    } else {
      order.push('AWAY')
      awayRemaining -= 1
    }
    homeTurn = !homeTurn
  }
  return order
}

function parseLineToken(whole: string, fraction?: string): number {
  return fraction ? Number(`${whole}.${fraction}`) : Number(whole)
}

export function settleMarket(
  selectionId: string,
  homeScore: number,
  awayScore: number,
  context: MarketSettlementContext = {},
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

  const halves = halfScoreSplit(homeScore, awayScore, context)
  const firstHalfGoals = halves.first.home + halves.first.away
  const secondHalfGoals = halves.second.home + halves.second.away
  const firstHalfOutcome = outcomeForScore(halves.first.home, halves.first.away)
  const secondHalfOutcome = outcomeForScore(halves.second.home, halves.second.away)
  const fullOutcome = outcomeForScore(homeScore, awayScore)

  const halfTotal = /^H([12])_(OVER|UNDER)_(\d+)_(\d+)$/.exec(selectionId)
  if (halfTotal) {
    const line = parseLineToken(halfTotal[3]!, halfTotal[4])
    const goals = halfTotal[1] === '1' ? firstHalfGoals : secondHalfGoals
    return halfTotal[2] === 'OVER' ? goals > line : goals < line
  }

  const halfResult = /^H([12])_(HOME|DRAW|AWAY)$/.exec(selectionId)
  if (halfResult) {
    const outcome = halfResult[1] === '1' ? firstHalfOutcome : secondHalfOutcome
    return outcome === halfResult[2]
  }

  const htft = /^HTFT_(HOME|DRAW|AWAY)_(HOME|DRAW|AWAY)$/.exec(selectionId)
  if (htft) {
    return firstHalfOutcome === htft[1] && fullOutcome === htft[2]
  }

  if (
    selectionId.startsWith('FG_TEAM_') ||
    selectionId.startsWith('LG_TEAM_') ||
    selectionId.startsWith('NG_TEAM_')
  ) {
    const order = context.goalOrder?.length ? context.goalOrder : goalOrder(homeScore, awayScore)
    const firstTeam = order[0] ?? 'NONE'
    const lastTeam = order[order.length - 1] ?? 'NONE'
    if (selectionId.startsWith('FG_TEAM_')) return selectionId === `FG_TEAM_${firstTeam}`
    if (selectionId.startsWith('LG_TEAM_')) return selectionId === `LG_TEAM_${lastTeam}`
    return selectionId === `NG_TEAM_${firstTeam}`
  }

  if (selectionId.startsWith('CORRECT_SCORE_')) {
    if (selectionId === 'CORRECT_SCORE_OTHER') {
      return !COMMON_CORRECT_SCORES.some(score => score.home === homeScore && score.away === awayScore)
    }
    const correctScore = /^CORRECT_SCORE_(\d+)_(\d+)$/.exec(selectionId)
    if (!correctScore) return null
    return Number(correctScore[1]) === homeScore && Number(correctScore[2]) === awayScore
  }

  if (selectionId === 'GOALS_ODD' || selectionId === 'GOALS_EVEN') {
    return (selectionId === 'GOALS_ODD') === (totalGoals % 2 === 1)
  }

  if (selectionId.startsWith('WIN_BOTH_HALVES_')) {
    const target = selectionId.slice('WIN_BOTH_HALVES_'.length)
    if (target === 'NO') {
      return !(firstHalfOutcome === secondHalfOutcome && firstHalfOutcome !== 'DRAW')
    }
    return (
      (target === 'HOME' || target === 'AWAY') &&
      firstHalfOutcome === target &&
      secondHalfOutcome === target
    )
  }

  if (selectionId.startsWith('SCORE_BOTH_HALVES_')) {
    const target = selectionId.slice('SCORE_BOTH_HALVES_'.length)
    if (target === 'NO') {
      return !(halves.first.home > 0 && halves.second.home > 0) &&
        !(halves.first.away > 0 && halves.second.away > 0)
    }
    return (
      (target === 'HOME' || target === 'AWAY') &&
      (target === 'HOME'
        ? halves.first.home > 0 && halves.second.home > 0
        : halves.first.away > 0 && halves.second.away > 0)
    )
  }

  if (selectionId.startsWith('WIN_TO_NIL_')) {
    if (selectionId === 'WIN_TO_NIL_NO') {
      return !(fullOutcome !== 'DRAW' && (fullOutcome === 'HOME' ? awayScore === 0 : homeScore === 0))
    }
    return (
      selectionId === `WIN_TO_NIL_${fullOutcome}` &&
      (fullOutcome === 'HOME' ? awayScore === 0 : homeScore === 0)
    )
  }

  if (selectionId.startsWith('CLEAN_SHEET_')) {
    if (selectionId === 'CLEAN_SHEET_HOME_YES') return awayScore === 0
    if (selectionId === 'CLEAN_SHEET_HOME_NO') return awayScore !== 0
    if (selectionId === 'CLEAN_SHEET_AWAY_YES') return homeScore === 0
    if (selectionId === 'CLEAN_SHEET_AWAY_NO') return homeScore !== 0
    return null
  }

  const handicap2 = /^HCP2_(HOME|AWAY)_(MINUS|PLUS)_(\d+)_(\d+)$/.exec(selectionId)
  if (handicap2) {
    const magnitude = parseLineToken(handicap2[3]!, handicap2[4])
    const line = handicap2[2] === 'MINUS' ? -magnitude : magnitude
    const adjustedHome = handicap2[1] === 'HOME' ? homeScore + line : homeScore
    const adjustedAway = handicap2[1] === 'AWAY' ? awayScore + line : awayScore
    return adjustedHome > adjustedAway
  }

  const handicap3 = /^HCP3_(HOME|DRAW|AWAY)_(MINUS|PLUS)_(\d+)(?:_(\d+))?$/.exec(selectionId)
  if (handicap3) {
    const magnitude = parseLineToken(handicap3[3]!, handicap3[4])
    const line = handicap3[2] === 'MINUS' ? -magnitude : magnitude
    return outcomeForScore(Math.max(0, homeScore + line), awayScore) === handicap3[1]
  }

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
