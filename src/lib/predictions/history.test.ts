import { describe, expect, it } from 'vitest'
import {
  brierScoreForSelection,
  settleSelections,
  type ActualFixtureResult,
  type SettleableSelection,
} from './history-settlement'

function selection(overrides: Partial<SettleableSelection> = {}): SettleableSelection {
  return {
    fixtureId: 'fixture-1',
    outcomeKey: 'HOME',
    homeProbability: 0.6,
    drawProbability: 0.25,
    awayProbability: 0.15,
    ...overrides,
  }
}

function fixtures(
  entries: Array<[string, ActualFixtureResult]>,
): Map<string, ActualFixtureResult> {
  return new Map(entries)
}

describe('history settlement', () => {
  it('scores a perfectly correct selection with a zero Brier score', () => {
    const input = selection({ outcomeKey: 'HOME', homeProbability: 1, drawProbability: 0, awayProbability: 0 })
    expect(brierScoreForSelection(input, 'HOME')).toBe(0)
  })

  it('scores a wrong selection against all three probabilities', () => {
    const input = selection({ outcomeKey: 'HOME', homeProbability: 0.6, drawProbability: 0.25, awayProbability: 0.15 })
    expect(brierScoreForSelection(input, 'AWAY')).toBeCloseTo(1.145, 5)
  })

  it('marks a slip won when every finished selection is correct', () => {
    const result = settleSelections(
      [selection(), selection({ fixtureId: 'fixture-2', outcomeKey: 'DRAW' })],
      fixtures([
        ['fixture-1', { status: 'FINISHED', homeScore: 2, awayScore: 0 }],
        ['fixture-2', { status: 'FINISHED', homeScore: 1, awayScore: 1 }],
      ]),
    )
    expect(result.status).toBe('WON')
    expect(result.selections.every(item => item.correct === true)).toBe(true)
    expect(result.brierScore).not.toBeNull()
    expect(result.settledAt).toBeInstanceOf(Date)
  })

  it('marks a slip lost as soon as one selection misses', () => {
    const result = settleSelections(
      [selection(), selection({ fixtureId: 'fixture-2', outcomeKey: 'DRAW' })],
      fixtures([
        ['fixture-1', { status: 'FINISHED', homeScore: 2, awayScore: 0 }],
        ['fixture-2', { status: 'FINISHED', homeScore: 1, awayScore: 0 }],
      ]),
    )
    expect(result.status).toBe('LOST')
    expect(result.selections[0]?.correct).toBe(true)
    expect(result.selections[1]?.correct).toBe(false)
    expect(result.settledAt).toBeInstanceOf(Date)
  })

  it('stays pending until every fixture is resolved', () => {
    const result = settleSelections(
      [selection(), selection({ fixtureId: 'fixture-2' })],
      fixtures([
        ['fixture-1', { status: 'FINISHED', homeScore: 2, awayScore: 0 }],
        ['fixture-2', { status: 'LIVE', homeScore: null, awayScore: null }],
      ]),
    )
    expect(result.status).toBe('PENDING')
    expect(result.settledAt).toBeNull()
    expect(result.selections.filter(item => item.pending)).toHaveLength(1)
  })

  it('voids a slip when a fixture is postponed or missing', () => {
    const result = settleSelections(
      [selection(), selection({ fixtureId: 'fixture-2', outcomeKey: 'AWAY' })],
      fixtures([
        ['fixture-1', { status: 'FINISHED', homeScore: 2, awayScore: 0 }],
        ['fixture-2', { status: 'POSTPONED', homeScore: null, awayScore: null }],
      ]),
    )
    expect(result.status).toBe('VOID')
    expect(result.selections[1]?.void).toBe(true)
  })

  it('treats a finished fixture without a score as void, not a guess', () => {
    const result = settleSelections(
      [selection()],
      fixtures([['fixture-1', { status: 'FINISHED', homeScore: null, awayScore: null }]]),
    )
    expect(result.status).toBe('VOID')
    expect(result.selections[0]?.actualOutcome).toBeNull()
  })

  it('settles double chance, totals, and both-teams-to-score markets', () => {
    const result = settleSelections(
      [
        selection({ fixtureId: 'fixture-1', outcomeKey: 'DC_HOME_DRAW', probability: 0.7 }),
        selection({ fixtureId: 'fixture-2', outcomeKey: 'OVER_2_5', probability: 0.62 }),
        selection({ fixtureId: 'fixture-3', outcomeKey: 'BTTS_YES', probability: 0.58 }),
      ],
      fixtures([
        ['fixture-1', { status: 'FINISHED', homeScore: 1, awayScore: 0 }],
        ['fixture-2', { status: 'FINISHED', homeScore: 2, awayScore: 1 }],
        ['fixture-3', { status: 'FINISHED', homeScore: 2, awayScore: 2 }],
      ]),
    )
    expect(result.status).toBe('WON')
    expect(result.selections.every(item => item.correct === true)).toBe(true)
    expect(result.brierScore).not.toBeNull()
  })

  it('voids an unknown market key instead of guessing a result', () => {
    const result = settleSelections(
      [selection({ outcomeKey: 'UNKNOWN_MARKET' })],
      fixtures([['fixture-1', { status: 'FINISHED', homeScore: 1, awayScore: 0 }]]),
    )
    expect(result.status).toBe('VOID')
    expect(result.selections[0]?.void).toBe(true)
  })
})
