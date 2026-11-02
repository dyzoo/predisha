import type { Fixture, Team } from '@/lib/sports/provider'

export type FormResult = 'W' | 'D' | 'L'
export type OutcomeKey = 'HOME' | 'DRAW' | 'AWAY'
export type MarketRisk = 'low' | 'medium' | 'high'
export type MarketKey =
  | OutcomeKey
  | 'DC_HOME_DRAW'
  | 'DC_DRAW_AWAY'
  | 'DC_HOME_AWAY'
  | 'OVER_1_5'
  | 'OVER_2_5'
  | 'UNDER_3_5'
  | 'BTTS_YES'
  | 'BTTS_NO'

export interface MarketOption {
  key: MarketKey
  market: string
  label: string
  shortLabel: string
  probability: number
  impliedOdds: number
  risk: MarketRisk
}

export function marketRiskFor(probability: number): MarketRisk {
  if (probability >= 0.72) return 'low'
  if (probability >= 0.56) return 'medium'
  return 'high'
}

export const MODEL_VERSION = 'elo-poisson-0.1.0'
export const MODEL_NAME = 'Elo + Poisson baseline'

export const MODEL_CONFIG = {
  startingElo: 1500,
  kFactor: 24,
  homeAdvantageElo: 70,
  leagueAverageGoals: 1.35,
  homeGoalFactor: 1.16,
  awayGoalFactor: 0.92,
  minimumMatches: 3,
  formWindow: 5,
  statsWindow: 10,
  maxInputAgeHours: 24 * 21,
  rankingMinimumProbability: 0.42,
  maxGoals: 8,
} as const

export interface TeamFeatures {
  teamId: string
  elo: number
  matches: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  form: FormResult[]
}

export interface MatchFeatures {
  matchId: string
  homeTeamId: string
  awayTeamId: string
  asOf: Date
  inputDataAsOf: Date | null
  home: TeamFeatures
  away: TeamFeatures
  source: 'demo' | 'provider'
  dataQualityFlags: string[]
}

export interface PredictionOutcome {
  key: OutcomeKey
  probability: number
}

export interface PredictionResult {
  market: '1X2'
  outcomes: PredictionOutcome[]
  marketOptions?: MarketOption[]
  modelVersion: string
  modelName: string
  generatedAt: Date
  inputDataAsOf: Date
  homeExpectedGoals: number
  awayExpectedGoals: number
  qualityFlags: string[]
  structuredFacts: {
    homeElo: number
    awayElo: number
    homeMatches: number
    awayMatches: number
    homeForm: FormResult[]
    awayForm: FormResult[]
    homeGoalsPerMatch: number
    awayGoalsPerMatch: number
    homeGoalsConcededPerMatch: number
    awayGoalsConcededPerMatch: number
    homeAdvantageElo: number
    leagueAverageGoals: number
  }
}

export interface PredictionValidation {
  ok: boolean
  issues: string[]
}

export interface EvaluationResult {
  actualOutcome: OutcomeKey
  brierScore: number
  logLoss: number
  correct: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function poissonProbability(lambda: number, goals: number): number {
  let factorial = 1
  for (let index = 2; index <= goals; index += 1) factorial *= index
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial
}

export function outcomeForScore(homeGoals: number, awayGoals: number): OutcomeKey {
  if (homeGoals > awayGoals) return 'HOME'
  if (homeGoals < awayGoals) return 'AWAY'
  return 'DRAW'
}

function emptyTeamFeatures(teamId: string, startingElo: number): TeamFeatures {
  return {
    teamId,
    elo: startingElo,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    form: [],
  }
}

function expectedHomeScore(homeElo: number, awayElo: number): number {
  return 1 / (1 + Math.pow(10, (awayElo - (homeElo + MODEL_CONFIG.homeAdvantageElo)) / 400))
}

/**
 * Builds leakage-safe features using only finished matches strictly before
 * `asOf`. The target fixture is always excluded, and future results are never
 * read even when they exist in the dataset.
 */
export function buildMatchFeatures(
  fixture: Fixture,
  fixtures: Fixture[],
  teams: Team[],
  asOf: Date,
  source: 'demo' | 'provider',
): MatchFeatures {
  const eligible = fixtures
    .filter(
      candidate =>
        candidate.id !== fixture.id &&
        candidate.status === 'FINISHED' &&
        candidate.homeScore !== null &&
        candidate.homeScore !== undefined &&
        candidate.awayScore !== null &&
        candidate.awayScore !== undefined &&
        candidate.kickoffUtc.getTime() < asOf.getTime(),
    )
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())

  const ratings = new Map<string, number>()
  const teamNames = new Map(teams.map(team => [team.id, team.name]))
  for (const team of teams) ratings.set(team.id, MODEL_CONFIG.startingElo)

  for (const candidate of eligible) {
    const homeRating = ratings.get(candidate.homeTeamId) ?? MODEL_CONFIG.startingElo
    const awayRating = ratings.get(candidate.awayTeamId) ?? MODEL_CONFIG.startingElo
    const homeScore = candidate.homeScore as number
    const awayScore = candidate.awayScore as number
    const actual = homeScore === awayScore ? 0.5 : homeScore > awayScore ? 1 : 0
    const expected = expectedHomeScore(homeRating, awayRating)
    const goalMultiplier = 1 + Math.min(Math.abs(homeScore - awayScore), 3) * 0.15
    const change = MODEL_CONFIG.kFactor * goalMultiplier * (actual - expected)
    ratings.set(candidate.homeTeamId, homeRating + change)
    ratings.set(candidate.awayTeamId, awayRating - change)
  }

  function summarize(teamId: string): TeamFeatures {
    const teamFixtures = eligible
      .filter(
        candidate =>
          candidate.homeTeamId === teamId || candidate.awayTeamId === teamId,
      )
      .slice(-MODEL_CONFIG.statsWindow)

    const features = emptyTeamFeatures(
      teamId,
      ratings.get(teamId) ?? MODEL_CONFIG.startingElo,
    )

    for (const candidate of teamFixtures) {
      const isHome = candidate.homeTeamId === teamId
      const scored = (isHome ? candidate.homeScore : candidate.awayScore) as number
      const conceded = (isHome ? candidate.awayScore : candidate.homeScore) as number
      features.matches += 1
      features.goalsFor += scored
      features.goalsAgainst += conceded
      if (scored > conceded) features.wins += 1
      else if (scored === conceded) features.draws += 1
      else features.losses += 1
      features.form.push(scored > conceded ? 'W' : scored === conceded ? 'D' : 'L')
    }

    features.form = features.form.slice(-MODEL_CONFIG.formWindow)
    return features
  }

  const home = summarize(fixture.homeTeamId)
  const away = summarize(fixture.awayTeamId)
  const latest = eligible.length > 0 ? eligible[eligible.length - 1].kickoffUtc : null
  const flags: string[] = []

  if (source === 'demo') flags.push('DEMO_DATA')
  if (home.matches < MODEL_CONFIG.minimumMatches || away.matches < MODEL_CONFIG.minimumMatches) {
    flags.push('LOW_SAMPLE')
  }
  if (!latest) {
    flags.push('MISSING_INPUT')
  } else {
    const ageHours = (asOf.getTime() - latest.getTime()) / (60 * 60 * 1000)
    if (ageHours > MODEL_CONFIG.maxInputAgeHours) flags.push('STALE_INPUT')
  }

  if (home.matches === 0 || away.matches === 0) {
    // Keep the team names available to callers building user-facing copy.
    void teamNames
  }

  return {
    matchId: fixture.id,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    asOf,
    inputDataAsOf: latest,
    home,
    away,
    source,
    dataQualityFlags: flags,
  }
}

export function validatePrediction(prediction: PredictionResult): PredictionValidation {
  const issues: string[] = []
  const outcomes = prediction.outcomes

  if (outcomes.length !== 3) issues.push('1X2 must have exactly three outcomes')
  const keys = new Set(outcomes.map(outcome => outcome.key))
  for (const key of ['HOME', 'DRAW', 'AWAY'] as const) {
    if (!keys.has(key)) issues.push(`Missing outcome ${key}`)
  }

  for (const outcome of outcomes) {
    if (!Number.isFinite(outcome.probability)) {
      issues.push(`Probability for ${outcome.key} is not finite`)
    } else if (outcome.probability < 0 || outcome.probability > 1) {
      issues.push(`Probability for ${outcome.key} is outside 0-1`)
    }
  }

  const sum = outcomes.reduce((total, outcome) => total + outcome.probability, 0)
  if (Math.abs(sum - 1) > 1e-6) issues.push('Outcome probabilities must sum to 1')

  if (!Number.isFinite(prediction.homeExpectedGoals) || !Number.isFinite(prediction.awayExpectedGoals)) {
    issues.push('Expected goals must be finite')
  }

  return { ok: issues.length === 0, issues }
}

export function predictMatch(
  features: MatchFeatures,
  modelVersion: string = MODEL_VERSION,
): PredictionResult | null {
  if (features.dataQualityFlags.includes('MISSING_INPUT')) return null
  if (features.dataQualityFlags.includes('LOW_SAMPLE')) return null
  if (features.dataQualityFlags.includes('STALE_INPUT')) return null
  if (features.home.matches < MODEL_CONFIG.minimumMatches) return null
  if (features.away.matches < MODEL_CONFIG.minimumMatches) return null

  const leagueAverage = MODEL_CONFIG.leagueAverageGoals
  const homeAttack = features.home.goalsFor / features.home.matches / leagueAverage
  const awayDefence = features.away.goalsAgainst / features.away.matches / leagueAverage
  const awayAttack = features.away.goalsFor / features.away.matches / leagueAverage
  const homeDefence = features.home.goalsAgainst / features.home.matches / leagueAverage

  const eloDifference =
    features.home.elo + MODEL_CONFIG.homeAdvantageElo - features.away.elo
  const eloAdjustment = clamp(1 + eloDifference / 800, 0.55, 1.65)

  const homeExpectedGoals = clamp(
    leagueAverage * homeAttack * awayDefence * MODEL_CONFIG.homeGoalFactor * eloAdjustment,
    0.15,
    4.5,
  )
  const awayExpectedGoals = clamp(
    leagueAverage * awayAttack * homeDefence * MODEL_CONFIG.awayGoalFactor * (1 / eloAdjustment),
    0.15,
    4.5,
  )

  let home = 0
  let draw = 0
  let away = 0
  let over15 = 0
  let over25 = 0
  let under35 = 0
  let bttsYes = 0
  for (let homeGoals = 0; homeGoals <= MODEL_CONFIG.maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= MODEL_CONFIG.maxGoals; awayGoals += 1) {
      const probability =
        poissonProbability(homeExpectedGoals, homeGoals) *
        poissonProbability(awayExpectedGoals, awayGoals)
      const outcome = outcomeForScore(homeGoals, awayGoals)
      if (outcome === 'HOME') home += probability
      else if (outcome === 'DRAW') draw += probability
      else away += probability

      const totalGoals = homeGoals + awayGoals
      if (totalGoals > 1.5) over15 += probability
      if (totalGoals > 2.5) over25 += probability
      if (totalGoals < 3.5) under35 += probability
      if (homeGoals > 0 && awayGoals > 0) bttsYes += probability
    }
  }

  const total = home + draw + away
  const normalise = (value: number) => value / total
  const homeProbability = normalise(home)
  const drawProbability = normalise(draw)
  const awayProbability = normalise(away)
  const bttsYesProbability = normalise(bttsYes)
  const marketProbabilities: Array<Omit<MarketOption, 'impliedOdds' | 'risk'>> = [
    {
      key: 'HOME',
      market: '1X2',
      label: 'Home win',
      shortLabel: 'Home',
      probability: homeProbability,
    },
    {
      key: 'DRAW',
      market: '1X2',
      label: 'Draw',
      shortLabel: 'Draw',
      probability: drawProbability,
    },
    {
      key: 'AWAY',
      market: '1X2',
      label: 'Away win',
      shortLabel: 'Away',
      probability: awayProbability,
    },
    {
      key: 'DC_HOME_DRAW',
      market: 'Double chance',
      label: 'Home or draw',
      shortLabel: '1X',
      probability: homeProbability + drawProbability,
    },
    {
      key: 'DC_DRAW_AWAY',
      market: 'Double chance',
      label: 'Draw or away',
      shortLabel: 'X2',
      probability: drawProbability + awayProbability,
    },
    {
      key: 'DC_HOME_AWAY',
      market: 'Double chance',
      label: 'Home or away',
      shortLabel: '12',
      probability: homeProbability + awayProbability,
    },
    {
      key: 'OVER_1_5',
      market: 'Total goals',
      label: 'Over 1.5 goals',
      shortLabel: 'O1.5',
      probability: normalise(over15),
    },
    {
      key: 'OVER_2_5',
      market: 'Total goals',
      label: 'Over 2.5 goals',
      shortLabel: 'O2.5',
      probability: normalise(over25),
    },
    {
      key: 'UNDER_3_5',
      market: 'Total goals',
      label: 'Under 3.5 goals',
      shortLabel: 'U3.5',
      probability: normalise(under35),
    },
    {
      key: 'BTTS_YES',
      market: 'Both teams to score',
      label: 'Both teams to score',
      shortLabel: 'BTTS',
      probability: bttsYesProbability,
    },
    {
      key: 'BTTS_NO',
      market: 'Both teams to score',
      label: 'Both teams not to score',
      shortLabel: 'No BTTS',
      probability: 1 - bttsYesProbability,
    },
  ]
  const marketOptions: MarketOption[] = marketProbabilities.map(option => ({
    ...option,
    impliedOdds: option.probability > 0 ? 1 / option.probability : 0,
    risk: marketRiskFor(option.probability),
  }))

  const prediction: PredictionResult = {
    market: '1X2',
    outcomes: [
      { key: 'HOME', probability: homeProbability },
      { key: 'DRAW', probability: drawProbability },
      { key: 'AWAY', probability: awayProbability },
    ],
    marketOptions,
    modelVersion,
    modelName: MODEL_NAME,
    generatedAt: new Date(),
    inputDataAsOf: features.inputDataAsOf ?? features.asOf,
    homeExpectedGoals,
    awayExpectedGoals,
    qualityFlags: features.dataQualityFlags,
    structuredFacts: {
      homeElo: Math.round(features.home.elo),
      awayElo: Math.round(features.away.elo),
      homeMatches: features.home.matches,
      awayMatches: features.away.matches,
      homeForm: features.home.form,
      awayForm: features.away.form,
      homeGoalsPerMatch: Number((features.home.goalsFor / features.home.matches).toFixed(2)),
      awayGoalsPerMatch: Number((features.away.goalsFor / features.away.matches).toFixed(2)),
      homeGoalsConcededPerMatch: Number(
        (features.home.goalsAgainst / features.home.matches).toFixed(2),
      ),
      awayGoalsConcededPerMatch: Number(
        (features.away.goalsAgainst / features.away.matches).toFixed(2),
      ),
      homeAdvantageElo: MODEL_CONFIG.homeAdvantageElo,
      leagueAverageGoals: MODEL_CONFIG.leagueAverageGoals,
    },
  }

  return validatePrediction(prediction).ok ? prediction : null
}

export function evaluatePrediction(
  prediction: PredictionResult,
  actualHomeScore: number,
  actualAwayScore: number,
): EvaluationResult {
  const actualOutcome = outcomeForScore(actualHomeScore, actualAwayScore)
  const actualVector: Record<OutcomeKey, number> = {
    HOME: actualOutcome === 'HOME' ? 1 : 0,
    DRAW: actualOutcome === 'DRAW' ? 1 : 0,
    AWAY: actualOutcome === 'AWAY' ? 1 : 0,
  }

  let brierScore = 0
  let actualProbability = 0
  let correct = false
  for (const outcome of prediction.outcomes) {
    const difference = outcome.probability - actualVector[outcome.key]
    brierScore += difference * difference
    if (outcome.key === actualOutcome) {
      actualProbability = outcome.probability
      correct = outcome.probability === Math.max(...prediction.outcomes.map(item => item.probability))
    }
  }

  return {
    actualOutcome,
    brierScore,
    logLoss: -Math.log(Math.max(actualProbability, 1e-15)),
    correct,
  }
}

export interface RankablePrediction {
  probability: number
  modelVersion: string
  qualityFlags: string[]
}

/**
 * Documented MVP ranking rule: only predictions whose top outcome clears the
 * configured threshold and that carry no data-quality flags are ranked, highest
 * probability first. This is a display ordering, not a promise of an outcome.
 */
export function rankPredictions<T extends RankablePrediction>(items: T[]): T[] {
  const blockingFlags = new Set(['LOW_SAMPLE', 'STALE_INPUT', 'MISSING_INPUT'])
  return items
    .filter(
      item =>
        item.probability >= MODEL_CONFIG.rankingMinimumProbability &&
        !item.qualityFlags.some(flag => blockingFlags.has(flag)),
    )
    .sort((a, b) => b.probability - a.probability)
}
