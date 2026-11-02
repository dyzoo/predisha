import { outcomeForScore, type OutcomeKey } from './engine'

export type SlipStatusValue = 'PENDING' | 'WON' | 'LOST' | 'VOID'

export interface ActualFixtureResult {
  status: string
  homeScore: number | null
  awayScore: number | null
}

export interface SettleableSelection {
  fixtureId: string
  outcomeKey: string
  probability?: number
  homeProbability: number
  drawProbability: number
  awayProbability: number
}

export interface SelectionSettlement {
  actualOutcome: OutcomeKey | null
  correct: boolean | null
  brierScore: number | null
  pending: boolean
  void: boolean
}

export interface SlipSettlement {
  status: SlipStatusValue
  brierScore: number | null
  settledAt: Date | null
  selections: SelectionSettlement[]
}

function isOutcomeKey(value: string): value is OutcomeKey {
  return value === 'HOME' || value === 'DRAW' || value === 'AWAY'
}

function marketCorrect(key: string, homeScore: number, awayScore: number): boolean | null {
  const totalGoals = homeScore + awayScore
  if (isOutcomeKey(key)) return key === outcomeForScore(homeScore, awayScore)
  if (key === 'DC_HOME_DRAW') return homeScore >= awayScore
  if (key === 'DC_DRAW_AWAY') return homeScore <= awayScore
  if (key === 'DC_HOME_AWAY') return homeScore !== awayScore
  if (key === 'OVER_1_5') return totalGoals > 1.5
  if (key === 'OVER_2_5') return totalGoals > 2.5
  if (key === 'UNDER_3_5') return totalGoals < 3.5
  if (key === 'BTTS_YES') return homeScore > 0 && awayScore > 0
  if (key === 'BTTS_NO') return homeScore === 0 || awayScore === 0
  return null
}

export function brierScoreForSelection(
  selection: SettleableSelection,
  actualOutcome: OutcomeKey,
): number {
  const vector: Record<OutcomeKey, number> = {
    HOME: actualOutcome === 'HOME' ? 1 : 0,
    DRAW: actualOutcome === 'DRAW' ? 1 : 0,
    AWAY: actualOutcome === 'AWAY' ? 1 : 0,
  }
  return (
    (selection.homeProbability - vector.HOME) ** 2 +
    (selection.drawProbability - vector.DRAW) ** 2 +
    (selection.awayProbability - vector.AWAY) ** 2
  )
}

/**
 * Pure settlement function so history rules are testable without a database.
 * A slip is lost as soon as any selection is wrong, remains pending while any
 * selection is unresolved, and is void when a fixture is postponed/cancelled.
 */
export function settleSelections(
  selections: SettleableSelection[],
  fixturesById: Map<string, ActualFixtureResult | undefined>,
): SlipSettlement {
  const results: SelectionSettlement[] = []
  let anyWrong = false
  let anyPending = false
  let anyVoid = false
  const scored: number[] = []

  for (const selection of selections) {
    const fixture = fixturesById.get(selection.fixtureId)
    if (!fixture) {
      anyVoid = true
      results.push({ actualOutcome: null, correct: null, brierScore: null, pending: false, void: true })
      continue
    }

    if (fixture.status === 'FINISHED') {
      if (typeof fixture.homeScore !== 'number' || typeof fixture.awayScore !== 'number') {
        anyVoid = true
        results.push({ actualOutcome: null, correct: null, brierScore: null, pending: false, void: true })
        continue
      }
      const actualOutcome = outcomeForScore(fixture.homeScore, fixture.awayScore)
      const correct = marketCorrect(selection.outcomeKey, fixture.homeScore, fixture.awayScore)
      if (correct === null) {
        anyVoid = true
        results.push({ actualOutcome, correct: null, brierScore: null, pending: false, void: true })
        continue
      }
      const brierScore = isOutcomeKey(selection.outcomeKey)
        ? brierScoreForSelection(selection, actualOutcome)
        : typeof selection.probability === 'number'
          ? (selection.probability - (correct ? 1 : 0)) ** 2
          : null
      if (!correct) anyWrong = true
      if (brierScore !== null) scored.push(brierScore)
      results.push({ actualOutcome, correct, brierScore, pending: false, void: false })
      continue
    }

    if (fixture.status === 'SCHEDULED' || fixture.status === 'LIVE') {
      anyPending = true
      results.push({ actualOutcome: null, correct: null, brierScore: null, pending: true, void: false })
      continue
    }

    anyVoid = true
    results.push({ actualOutcome: null, correct: null, brierScore: null, pending: false, void: true })
  }

  let status: SlipStatusValue
  if (anyWrong) status = 'LOST'
  else if (anyPending) status = 'PENDING'
  else if (anyVoid) status = 'VOID'
  else status = 'WON'

  const brierScore =
    scored.length > 0 ? scored.reduce((total, value) => total + value, 0) / scored.length : null
  const settledAt = status === 'PENDING' ? null : new Date()

  return { status, brierScore, settledAt, selections: results }
}

export interface PredictionHistorySelection {
  id: string
  fixtureId: string
  competition: string
  homeName: string
  awayName: string
  kickoffUtc: Date
  outcomeKey: string
  probability: number
  impliedOdds: number
  homeProbability: number
  drawProbability: number
  awayProbability: number
  actualOutcome: string | null
  correct: boolean | null
  brierScore: number | null
}

export interface PredictionHistoryItem {
  id: string
  stake: number
  currency: string
  risk: string
  odds: number | null
  oddsSource: string
  impliedCombinedOdds: number
  combinedProbability: number
  potentialReturn: number
  netProfit: number
  modelVersion: string | null
  generatedAt: Date
  demo: boolean
  limited: boolean
  status: SlipStatusValue
  brierScore: number | null
  settledAt: Date | null
  selections: PredictionHistorySelection[]
}

export interface HistorySummary {
  total: number
  won: number
  lost: number
  pending: number
  void: number
  averageBrier: number | null
}

export function summarizeHistory(slips: PredictionHistoryItem[]): HistorySummary {
  const summary: HistorySummary = {
    total: slips.length,
    won: 0,
    lost: 0,
    pending: 0,
    void: 0,
    averageBrier: null,
  }
  const scored: number[] = []
  for (const slip of slips) {
    if (slip.status === 'WON') summary.won += 1
    else if (slip.status === 'LOST') summary.lost += 1
    else if (slip.status === 'VOID') summary.void += 1
    else summary.pending += 1
    if (slip.brierScore !== null) scored.push(slip.brierScore)
  }
  if (scored.length > 0) {
    summary.averageBrier = scored.reduce((total, value) => total + value, 0) / scored.length
  }
  return summary
}
