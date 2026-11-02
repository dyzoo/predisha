import { PredictionResult } from './engine'

export interface BacktestResult {
  predictions: PredictionResult[]
  actualResults: Array<{ fixtureId: string; homeScore: number; awayScore: number }>
  brierScore: number
  logLoss: number
  calibration: Record<string, { meanPredicted: number; observed: number; count: number }>
  sampleSize: number
}

export function runChronologicalBacktest(
  predictions: PredictionResult[],
  actualResults: Array<{ fixtureId: string; homeScore: number; awayScore: number }>,
): BacktestResult {
  // Placeholder: requires chronological split and feature snapshot isolation.
  // Must not use future results in historical forecasts.
  return {
    predictions,
    actualResults,
    brierScore: 0,
    logLoss: 0,
    calibration: {},
    sampleSize: predictions.length,
  }
}
