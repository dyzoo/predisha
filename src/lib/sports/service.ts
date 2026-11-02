import { connection } from 'next/server'
import {
  buildMatchFeatures,
  evaluatePrediction,
  predictMatch,
  type EvaluationResult,
  type FormResult,
  type MatchFeatures,
  type PredictionResult,
} from '@/lib/predictions/engine'
import { getSportsProvider } from './demo'
import { prisma } from '@/lib/prisma'
import type {
  Competition,
  Fixture,
  FixtureStatus,
  ProviderHealth,
  Sport,
  Team,
} from './provider'

const DAY_MS = 24 * 60 * 60 * 1000

export interface MatchAnalysis {
  fixture: Fixture
  competition: Competition
  sport: Sport
  home: Team
  away: Team
  features: MatchFeatures
  prediction: PredictionResult | null
  evaluation: EvaluationResult | null
  explanation: string | null
  isDemo: boolean
}

export interface SportsDataset {
  sportList: Sport[]
  competitions: Competition[]
  teams: Team[]
  fixtures: Fixture[]
  health: ProviderHealth
  isDemo: boolean
}

function fixtureAsOf(fixture: Fixture, now: Date): Date {
  if (fixture.status === 'SCHEDULED') return now
  return new Date(fixture.kickoffUtc.getTime() - 1)
}

function buildExplanation(analysis: Omit<MatchAnalysis, 'explanation'>): string | null {
  const { prediction, home, away } = analysis
  if (!prediction) return null

  const homeProbability = Math.round(
    (prediction.outcomes.find(outcome => outcome.key === 'HOME')?.probability ?? 0) * 100,
  )
  const drawProbability = Math.round(
    (prediction.outcomes.find(outcome => outcome.key === 'DRAW')?.probability ?? 0) * 100,
  )
  const awayProbability = Math.round(
    (prediction.outcomes.find(outcome => outcome.key === 'AWAY')?.probability ?? 0) * 100,
  )
  const facts = prediction.structuredFacts

  return [
    `The baseline model estimates a ${homeProbability}% chance for ${home.name}, ${drawProbability}% for a draw and ${awayProbability}% for ${away.name}.`,
    `Inputs used: ${facts.homeMatches} recent ${home.name} matches and ${facts.awayMatches} recent ${away.name} matches before the prediction cutoff.`,
    `Average goals scored per match: ${home.name} ${facts.homeGoalsPerMatch.toFixed(2)}, ${away.name} ${facts.awayGoalsPerMatch.toFixed(2)}.`,
    `Rating snapshot: ${home.name} ${facts.homeElo}, ${away.name} ${facts.awayElo}, including a ${facts.homeAdvantageElo}-point home adjustment.`,
    'These are estimated probabilities, not certainties or betting advice. Missing or stale inputs are excluded rather than guessed.',
  ].join(' ')
}

async function resolveNow(now?: Date): Promise<Date> {
  if (now) return now
  await connection()
  return new Date()
}

export async function getSportsDataset(now?: Date): Promise<SportsDataset> {
  const at = await resolveNow(now)

  let sports: Array<{ id: string; name: string; slug: string }> = []
  let competitions: Array<{
    id: string
    name: string
    country: string | null
    season: string | null
    sportId: string
    providerId: string | null
  }> = []
  let teams: Array<{
    id: string
    name: string
    shortName: string
    color: string
    logoUrl: string | null
    providerId: string | null
  }> = []
  let fixtures: Fixture[] = []

  try {
    const [dbSports, dbCompetitions, dbTeams, dbFixtures] = await Promise.all([
      prisma.sport.findMany({ where: { active: true } }),
      prisma.competition.findMany({ where: { active: true } }),
      prisma.team.findMany(),
      prisma.fixture.findMany({
        where: {
          kickoffUtc: {
            gte: new Date(at.getTime() - 120 * DAY_MS),
            lte: new Date(at.getTime() + 30 * DAY_MS),
          },
        },
        include: { competition: true },
        orderBy: { kickoffUtc: 'asc' },
      }),
    ])

    const competitionsById = new Map(
      dbCompetitions.map(c => [c.id, c]),
    )

    sports = dbSports.map(s => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
    }))
    competitions = dbCompetitions.map(c => ({
      id: c.id,
      name: c.name,
      country: c.country ?? null,
      season: c.season ?? null,
      sportId: c.sportId,
      providerId: c.providerId ?? null,
    }))
    teams = dbTeams.map(t => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logoUrl: t.logoUrl ?? null,
      providerId: t.providerId ?? null,
    }))
    fixtures = dbFixtures.map(f => {
      const competition = competitionsById.get(f.competitionId)
      return {
        id: f.id,
        providerId: f.providerId ?? null,
        competitionId: f.competitionId,
        sportId: competition?.sportId ?? 'football',
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        kickoffUtc: f.kickoffUtc,
        status: f.status as FixtureStatus,
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        lastSyncedAt: f.lastSyncedAt ?? null,
      }
    })
  } catch {
    // Database not configured or unreachable. Return empty dataset;
    // the health check will report the provider status separately.
  }

  const provider = getSportsProvider()
  let health = await provider.getHealth().catch(() => ({
    ok: false,
    mode: 'unavailable' as ProviderHealth['mode'],
    message: 'Sports data provider unavailable.',
  }))

  let usedDemoData = false
  if (fixtures.length === 0 && health.mode === 'demo') {
    try {
      const from = new Date(at.getTime() - 120 * DAY_MS)
      const to = new Date(at.getTime() + 30 * DAY_MS)
      const [demoSports, demoCompetitions, demoTeams, demoFixtures] = await Promise.all([
        provider.getSports(),
        provider.getCompetitions(),
        provider.getTeams(),
        provider.getFixtures(from, to),
      ])
      if (demoFixtures.length > 0) {
        sports = demoSports.map(item => ({ id: item.id, name: item.name, slug: item.slug }))
        competitions = demoCompetitions.map(item => ({
          id: item.id,
          name: item.name,
          country: item.country ?? null,
          season: item.season ?? null,
          sportId: item.sportId,
          providerId: item.providerId ?? null,
        }))
        teams = demoTeams.map(item => ({
          id: item.id,
          name: item.name,
          shortName: item.shortName,
          color: item.color,
          logoUrl: item.logoUrl ?? null,
          providerId: item.providerId ?? null,
        }))
        fixtures = demoFixtures
        usedDemoData = true
      }
    } catch {
      // Fall through to the honest empty state.
    }
  }

  if (fixtures.length > 0 && !usedDemoData) {
    health = {
      ok: true,
      mode: 'stored',
      message: `${fixtures.length} fixtures loaded from the stored dataset.`,
    }
  }

  return {
    sportList: sports,
    competitions,
    teams,
    fixtures,
    health,
    isDemo: usedDemoData,
  }
}

export function buildMatchAnalyses(dataset: SportsDataset, now: Date = new Date()): MatchAnalysis[] {
  const teamsById = new Map(dataset.teams.map(team => [team.id, team]))
  const competitionsById = new Map(dataset.competitions.map(item => [item.id, item]))
  const sportsById = new Map(dataset.sportList.map(item => [item.id, item]))
  const providerName = dataset.isDemo ? 'demo' : 'provider'

  return dataset.fixtures
    .map(fixture => {
      const competition = competitionsById.get(fixture.competitionId)
      const home = teamsById.get(fixture.homeTeamId)
      const away = teamsById.get(fixture.awayTeamId)
      const sport = sportsById.get(fixture.sportId)
      if (!competition || !home || !away || !sport) return null

      const asOf = fixtureAsOf(fixture, now)
      const features = buildMatchFeatures(
        fixture,
        dataset.fixtures,
        dataset.teams,
        asOf,
        providerName,
      )
      const prediction = predictMatch(features)
      const evaluation =
        fixture.status === 'FINISHED' &&
        prediction &&
        typeof fixture.homeScore === 'number' &&
        typeof fixture.awayScore === 'number'
          ? evaluatePrediction(prediction, fixture.homeScore, fixture.awayScore)
          : null

      const base = {
        fixture,
        competition,
        sport,
        home,
        away,
        features,
        prediction,
        evaluation,
        isDemo: dataset.isDemo,
      }
      return { ...base, explanation: buildExplanation(base) }
    })
    .filter((analysis): analysis is MatchAnalysis => analysis !== null)
}

export async function getMatchAnalyses(now?: Date): Promise<{
  analyses: MatchAnalysis[]
  dataset: SportsDataset
}> {
  const at = await resolveNow(now)
  const dataset = await getSportsDataset(at)
  return { analyses: buildMatchAnalyses(dataset, at), dataset }
}

export async function getMatchAnalysis(
  fixtureId: string,
  now?: Date,
): Promise<{ analysis: MatchAnalysis | null; dataset: SportsDataset }> {
  const result = await getMatchAnalyses(now)
  return {
    analysis: result.analyses.find(item => item.fixture.id === fixtureId) ?? null,
    dataset: result.dataset,
  }
}

export interface PublicEvaluationSummary {
  sampleSize: number
  brierScore: number | null
  logLoss: number | null
  accuracy: number | null
  from: Date | null
  to: Date | null
}

export function summarizeEvaluations(analyses: MatchAnalysis[]): PublicEvaluationSummary {
  const evaluated = analyses.filter(
    analysis => analysis.evaluation !== null && analysis.fixture.status === 'FINISHED',
  )
  if (evaluated.length === 0) {
    return { sampleSize: 0, brierScore: null, logLoss: null, accuracy: null, from: null, to: null }
  }

  let brier = 0
  let logLoss = 0
  let correct = 0
  for (const analysis of evaluated) {
    brier += analysis.evaluation?.brierScore ?? 0
    logLoss += analysis.evaluation?.logLoss ?? 0
    if (analysis.evaluation?.correct) correct += 1
  }

  const kickoffs = evaluated.map(analysis => analysis.fixture.kickoffUtc.getTime())
  return {
    sampleSize: evaluated.length,
    brierScore: brier / evaluated.length,
    logLoss: logLoss / evaluated.length,
    accuracy: correct / evaluated.length,
    from: new Date(Math.min(...kickoffs)),
    to: new Date(Math.max(...kickoffs)),
  }
}

export function topOutcome(prediction: PredictionResult): {
  key: 'HOME' | 'DRAW' | 'AWAY'
  probability: number
} {
  return prediction.outcomes.reduce((best, outcome) =>
    outcome.probability > best.probability ? outcome : best,
  )
}

export function formFor(features: MatchFeatures, side: 'home' | 'away'): FormResult[] {
  return side === 'home' ? features.home.form : features.away.form
}
