import { describe, expect, it } from 'vitest'
import type { Fixture, Team } from '@/lib/sports/provider'
import {
  MODEL_CONFIG,
  buildMatchFeatures,
  evaluatePrediction,
  predictMatch,
  rankPredictions,
  validatePrediction,
  type MatchFeatures,
  type PredictionResult,
} from './engine'

const TEAMS: Team[] = [
  { id: 'home', name: 'Home FC', shortName: 'HOM', color: '#fff' },
  { id: 'away', name: 'Away FC', shortName: 'AWY', color: '#000' },
  { id: 'other', name: 'Other FC', shortName: 'OTH', color: '#888' },
]

function fixture(overrides: Partial<Fixture> & Pick<Fixture, 'id' | 'homeTeamId' | 'awayTeamId' | 'kickoffUtc'>): Fixture {
  return {
    competitionId: 'league',
    sportId: 'football',
    status: 'FINISHED',
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  }
}

function features(overrides: Partial<MatchFeatures> = {}): MatchFeatures {
  return {
    matchId: 'target',
    homeTeamId: 'home',
    awayTeamId: 'away',
    asOf: new Date('2026-01-01T00:00:00Z'),
    inputDataAsOf: new Date('2026-01-01T00:00:00Z'),
    source: 'provider',
    dataQualityFlags: [],
    home: {
      teamId: 'home',
      elo: 1600,
      matches: 6,
      wins: 4,
      draws: 1,
      losses: 1,
      goalsFor: 12,
      goalsAgainst: 5,
      form: ['W', 'W', 'D', 'W', 'L', 'W'],
    },
    away: {
      teamId: 'away',
      elo: 1400,
      matches: 6,
      wins: 1,
      draws: 2,
      losses: 3,
      goalsFor: 5,
      goalsAgainst: 10,
      form: ['L', 'D', 'L', 'W', 'L', 'D'],
    },
    ...overrides,
  }
}

describe('validatePrediction', () => {
  it('accepts a well-formed 1X2 prediction', () => {
    const prediction: PredictionResult = {
      market: '1X2',
      outcomes: [
        { key: 'HOME', probability: 0.5 },
        { key: 'DRAW', probability: 0.3 },
        { key: 'AWAY', probability: 0.2 },
      ],
      modelVersion: 'test',
      modelName: 'test',
      generatedAt: new Date(),
      inputDataAsOf: new Date(),
      homeExpectedGoals: 1.4,
      awayExpectedGoals: 0.9,
      qualityFlags: [],
      structuredFacts: {
        homeElo: 1500,
        awayElo: 1500,
        homeMatches: 5,
        awayMatches: 5,
        homeForm: [],
        awayForm: [],
        homeGoalsPerMatch: 1,
        awayGoalsPerMatch: 1,
        homeGoalsConcededPerMatch: 1,
        awayGoalsConcededPerMatch: 1,
        homeAdvantageElo: 70,
        leagueAverageGoals: 1.35,
      },
    }
    expect(validatePrediction(prediction)).toEqual({ ok: true, issues: [] })
  })

  it('rejects probabilities that do not sum to one', () => {
    const prediction = {
      outcomes: [
        { key: 'HOME', probability: 0.5 },
        { key: 'DRAW', probability: 0.3 },
        { key: 'AWAY', probability: 0.1 },
      ],
      homeExpectedGoals: 1,
      awayExpectedGoals: 1,
    } as PredictionResult
    const result = validatePrediction(prediction)
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('Outcome probabilities must sum to 1')
  })
})

describe('predictMatch', () => {
  it('withholds a prediction when data is missing or stale', () => {
    expect(predictMatch(features({ dataQualityFlags: ['MISSING_INPUT'] }))).toBeNull()
    expect(predictMatch(features({ dataQualityFlags: ['LOW_SAMPLE'] }))).toBeNull()
    expect(predictMatch(features({ dataQualityFlags: ['STALE_INPUT'] }))).toBeNull()
    expect(
      predictMatch(
        features({
          home: { ...features().home, matches: MODEL_CONFIG.minimumMatches - 1 },
        }),
      ),
    ).toBeNull()
  })

  it('produces normalised probabilities and favours the stronger home side', () => {
    const prediction = predictMatch(features())
    expect(prediction).not.toBeNull()
    const byKey = new Map(prediction!.outcomes.map(outcome => [outcome.key, outcome.probability]))
    const sum = [...byKey.values()].reduce((total, value) => total + value, 0)
    expect(sum).toBeCloseTo(1, 10)
    expect(byKey.get('HOME')!).toBeGreaterThan(byKey.get('AWAY')!)
    expect(validatePrediction(prediction!).ok).toBe(true)

    const markets = new Map(prediction!.marketOptions?.map(option => [option.key, option]))
    expect(markets.size).toBe(11)
    expect(markets.get('DC_HOME_DRAW')!.probability).toBeCloseTo(
      byKey.get('HOME')! + byKey.get('DRAW')!,
      10,
    )
    expect(markets.get('OVER_1_5')!.probability).toBeGreaterThan(
      markets.get('OVER_2_5')!.probability,
    )
    expect(markets.get('BTTS_YES')!.probability + markets.get('BTTS_NO')!.probability).toBeCloseTo(
      1,
      10,
    )
  })
})

describe('evaluatePrediction', () => {
  const prediction = {
    outcomes: [
      { key: 'HOME', probability: 0.6 },
      { key: 'DRAW', probability: 0.25 },
      { key: 'AWAY', probability: 0.15 },
    ],
  } as PredictionResult

  it('scores a correct top outcome', () => {
    const result = evaluatePrediction(prediction, 2, 1)
    expect(result.actualOutcome).toBe('HOME')
    expect(result.correct).toBe(true)
    expect(result.brierScore).toBeCloseTo(0.245, 10)
    expect(result.logLoss).toBeCloseTo(-Math.log(0.6), 10)
  })

  it('scores an incorrect top outcome without hiding it', () => {
    const result = evaluatePrediction(prediction, 0, 2)
    expect(result.actualOutcome).toBe('AWAY')
    expect(result.correct).toBe(false)
    expect(result.logLoss).toBeCloseTo(-Math.log(0.15), 10)
  })
})

describe('buildMatchFeatures', () => {
  it('only uses finished matches strictly before the cutoff and excludes the target', () => {
    const asOf = new Date('2026-03-01T00:00:00Z')
    const fixtures: Fixture[] = [
      fixture({ id: 'past-1', homeTeamId: 'home', awayTeamId: 'other', kickoffUtc: new Date('2026-02-01T00:00:00Z'), homeScore: 2, awayScore: 0 }),
      fixture({ id: 'past-2', homeTeamId: 'away', awayTeamId: 'home', kickoffUtc: new Date('2026-02-08T00:00:00Z'), homeScore: 0, awayScore: 1 }),
      fixture({ id: 'past-3', homeTeamId: 'home', awayTeamId: 'away', kickoffUtc: new Date('2026-02-15T00:00:00Z'), homeScore: 1, awayScore: 1 }),
      fixture({ id: 'past-4', homeTeamId: 'home', awayTeamId: 'other', kickoffUtc: new Date('2026-02-22T00:00:00Z'), homeScore: 3, awayScore: 0 }),
      fixture({ id: 'future', homeTeamId: 'home', awayTeamId: 'away', kickoffUtc: new Date('2026-03-05T00:00:00Z'), homeScore: 9, awayScore: 0 }),
      fixture({ id: 'target', homeTeamId: 'home', awayTeamId: 'away', status: 'SCHEDULED', kickoffUtc: new Date('2026-03-10T00:00:00Z'), homeScore: null, awayScore: null }),
    ]

    const result = buildMatchFeatures(fixtures[5], fixtures, TEAMS, asOf, 'provider')
    expect(result.home.matches).toBe(4)
    expect(result.away.matches).toBe(2)
    expect(result.home.goalsFor).toBe(7)
    expect(result.inputDataAsOf?.toISOString()).toBe('2026-02-22T00:00:00.000Z')
    expect(result.dataQualityFlags).toContain('LOW_SAMPLE')
  })

  it('flags stale inputs without inventing a prediction', () => {
    const asOf = new Date('2026-06-01T00:00:00Z')
    const fixtures: Fixture[] = Array.from({ length: 4 }, (_, index) =>
      fixture({
        id: `old-${index}`,
        homeTeamId: 'home',
        awayTeamId: 'away',
        kickoffUtc: new Date(`2026-01-0${index + 1}T00:00:00Z`),
      }),
    )
    const target = fixture({
      id: 'target',
      homeTeamId: 'home',
      awayTeamId: 'away',
      status: 'SCHEDULED',
      kickoffUtc: new Date('2026-06-02T00:00:00Z'),
      homeScore: null,
      awayScore: null,
    })
    const result = buildMatchFeatures(target, [...fixtures, target], TEAMS, asOf, 'provider')
    expect(result.dataQualityFlags).toContain('STALE_INPUT')
    expect(predictMatch(result)).toBeNull()
  })
})

describe('rankPredictions', () => {
  it('filters sub-threshold and blocked predictions then sorts by probability', () => {
    const ranked = rankPredictions([
      { id: 'a', probability: 0.45, modelVersion: 'v1', qualityFlags: [] },
      { id: 'b', probability: 0.62, modelVersion: 'v1', qualityFlags: [] },
      { id: 'c', probability: 0.7, modelVersion: 'v1', qualityFlags: ['LOW_SAMPLE'] },
      { id: 'd', probability: MODEL_CONFIG.rankingMinimumProbability - 0.01, modelVersion: 'v1', qualityFlags: [] },
    ])
    expect(ranked.map(item => item.id)).toEqual(['b', 'a'])
  })
})
