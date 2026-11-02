export interface OddsSnapshot {
  provider: string
  market: string
  selection: string
  decimalOdds: number
  timestamp: Date
  sourceUrl?: string
}

export function impliedProbability(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds < 1) return 0
  return 1 / decimalOdds
}

export function overround(probabilities: number[]): number {
  const sum = probabilities.reduce((a, b) => a + b, 0)
  return sum > 0 ? (sum - 1) / sum : 0
}

export function marginAdjustedProbability(rawProb: number, overround: number): number {
  if (overround <= 0) return rawProb
  return rawProb / (1 + overround)
}
