import { formatInTimeZone } from 'date-fns-tz'
import type {
  FormResult,
  MarketOption,
  OutcomeKey,
  TeamFeatures,
} from '@/lib/predictions/engine'
import type { Fixture, FixtureStatus, Team } from './provider'
import type { MatchAnalysis } from './service'

const STALE_MATCH_MS = 4 * 60 * 60 * 1000

export interface MatchTeamView {
  id: string
  name: string
  short: string
  color: string
  logoUrl: string | null
}

export interface MatchView {
  id: string
  competition: string
  competitionId: string
  sportId: string
  status: FixtureStatus
  effectiveStatus: FixtureStatus
  home: MatchTeamView
  away: MatchTeamView
  kickoffIso: string
  kickoffLabel: string
  score?: { home: number; away: number }
  minute: number | null
  halfTimeScore: { home: number; away: number } | null
  venue: string | null
  referee: string | null
  probability: { home: number; draw: number; away: number } | null
  expectedGoals: { home: number; away: number } | null
  marketOptions: MarketOption[]
  topOutcome: { key: OutcomeKey; probability: number } | null
  qualityFlags: string[]
  form: { home: FormResult[]; away: FormResult[] }
  modelVersion: string | null
  dataAsOfLabel: string | null
  dataAsOfIso: string | null
  explanation: string | null
  evaluation: {
    actualOutcome: OutcomeKey
    brierScore: number
    logLoss: number
    correct: boolean
  } | null
}

function shortLabel(shortName: string, name: string): string {
  if (shortName.trim()) return shortName.trim()
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '?'
}

export function formatMatchTime(date: Date, timeZone = 'UTC'): string {
  return `${formatInTimeZone(date, timeZone, 'EEE d MMM yyyy, HH:mm')} ${timeZone === 'UTC' ? 'UTC' : ''}`.trim()
}

export function formatDateTime(date: Date, timeZone = 'UTC'): string {
  return `${formatInTimeZone(date, timeZone, 'd MMM yyyy, HH:mm')} ${timeZone === 'UTC' ? 'UTC' : ''}`.trim()
}

function scorePair(
  home: number | null | undefined,
  away: number | null | undefined,
): { home: number; away: number } | null {
  if (typeof home !== 'number' || typeof away !== 'number') return null
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  return { home, away }
}

function deriveLiveMinute(fixture: Fixture, at: Date): number {
  const elapsed = Math.floor((at.getTime() - fixture.kickoffUtc.getTime()) / 60_000)
  const value =
    typeof fixture.liveMinute === 'number' && Number.isFinite(fixture.liveMinute)
      ? fixture.liveMinute
      : elapsed
  return Math.min(120, Math.max(1, Math.floor(value)))
}

export function toMatchView(analysis: MatchAnalysis, timeZone = 'UTC', now?: Date): MatchView {
  const { fixture, prediction, features } = analysis
  const at = now ?? new Date()
  const probability = prediction
    ? {
        home: prediction.outcomes.find(outcome => outcome.key === 'HOME')?.probability ?? 0,
        draw: prediction.outcomes.find(outcome => outcome.key === 'DRAW')?.probability ?? 0,
        away: prediction.outcomes.find(outcome => outcome.key === 'AWAY')?.probability ?? 0,
      }
    : null

  const top = prediction?.outcomes.reduce((best, outcome) =>
    outcome.probability > best.probability ? outcome : best,
  )

  const staleKickoff = fixture.kickoffUtc.getTime() < at.getTime() - STALE_MATCH_MS
  const effectiveStatus: FixtureStatus =
    fixture.status === 'FINISHED' ||
    (staleKickoff && (fixture.status === 'LIVE' || fixture.status === 'SCHEDULED'))
      ? 'FINISHED'
      : fixture.status
  const minute = effectiveStatus === 'LIVE' ? deriveLiveMinute(fixture, at) : null
  const halfTimeScore = scorePair(fixture.halfTimeHomeScore, fixture.halfTimeAwayScore)

  return {
    id: fixture.id,
    competition: analysis.competition.name,
    competitionId: analysis.competition.id,
    sportId: analysis.sport.id,
    status: fixture.status,
    effectiveStatus,
    home: {
      id: analysis.home.id,
      name: analysis.home.name,
      short: shortLabel(analysis.home.shortName, analysis.home.name),
      color: analysis.home.color,
      logoUrl: analysis.home.logoUrl ?? null,
    },
    away: {
      id: analysis.away.id,
      name: analysis.away.name,
      short: shortLabel(analysis.away.shortName, analysis.away.name),
      color: analysis.away.color,
      logoUrl: analysis.away.logoUrl ?? null,
    },
    kickoffIso: fixture.kickoffUtc.toISOString(),
    kickoffLabel: formatMatchTime(fixture.kickoffUtc, timeZone),
    score: scorePair(fixture.homeScore, fixture.awayScore) ?? undefined,
    minute,
    halfTimeScore,
    venue: fixture.venue ?? null,
    referee: fixture.referee ?? null,
    probability,
    expectedGoals: prediction
      ? { home: prediction.homeExpectedGoals, away: prediction.awayExpectedGoals }
      : null,
    marketOptions: prediction?.marketOptions ?? [],
    topOutcome: top ? { key: top.key, probability: top.probability } : null,
    qualityFlags: prediction?.qualityFlags ?? features.dataQualityFlags,
    form: { home: features.home.form, away: features.away.form },
    modelVersion: prediction?.modelVersion ?? null,
    dataAsOfLabel: prediction ? formatDateTime(prediction.inputDataAsOf, timeZone) : null,
    dataAsOfIso: prediction?.inputDataAsOf.toISOString() ?? null,
    explanation: analysis.explanation,
    evaluation: analysis.evaluation,
  }
}

export function outcomeLabel(key: OutcomeKey): string {
  if (key === 'HOME') return 'Home win'
  if (key === 'AWAY') return 'Away win'
  return 'Draw'
}

export interface RecentResultView {
  id: string
  kickoffIso: string
  kickoffLabel: string
  status: FixtureStatus
  competitionId: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  halfTimeHomeScore: number | null
  halfTimeAwayScore: number | null
  venue: string | null
  referee: string | null
}

export function toRecentResultView(fixture: Fixture, timeZone = 'UTC'): RecentResultView | null {
  const score = scorePair(fixture.homeScore, fixture.awayScore)
  if (!score) return null
  return {
    id: fixture.id,
    kickoffIso: fixture.kickoffUtc.toISOString(),
    kickoffLabel: formatMatchTime(fixture.kickoffUtc, timeZone),
    status: fixture.status,
    competitionId: fixture.competitionId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeTeamName: fixture.homeTeam?.name?.trim() || `Team ${fixture.homeTeamId}`,
    awayTeamName: fixture.awayTeam?.name?.trim() || `Team ${fixture.awayTeamId}`,
    homeScore: score.home,
    awayScore: score.away,
    halfTimeHomeScore: fixture.halfTimeHomeScore ?? null,
    halfTimeAwayScore: fixture.halfTimeAwayScore ?? null,
    venue: fixture.venue ?? null,
    referee: fixture.referee ?? null,
  }
}

export interface MatchStatsFixtureView {
  id: string
  kickoffIso: string
  kickoffLabel: string
  competitionId: string
  homeTeamId: string
  awayTeamId: string
  homeName: string
  awayName: string
  side: 'HOME' | 'AWAY'
  opponentName: string
  score: { home: number; away: number } | null
  result: FormResult | null
  status: FixtureStatus
}

export interface MatchStatsView {
  h2h: MatchStatsFixtureView[]
  form: { home: FormResult[]; away: FormResult[] }
  team: { home: TeamFeatures; away: TeamFeatures }
  fullTime: { home: number; away: number } | null
  halfTime: { home: number; away: number } | null
  venue: string | null
  referee: string | null
  recent: { home: MatchStatsFixtureView[]; away: MatchStatsFixtureView[] }
  upcoming: { home: MatchStatsFixtureView[]; away: MatchStatsFixtureView[] }
}

function resultFor(home: number, away: number): FormResult {
  if (home > away) return 'W'
  if (home < away) return 'L'
  return 'D'
}

export function buildMatchStatsView(
  analysis: MatchAnalysis,
  fixtures: Fixture[],
  teams: Team[] = [],
  now: Date = new Date(),
  timeZone = 'UTC',
): MatchStatsView {
  const { fixture, features, home, away } = analysis
  const names = new Map<string, string>()
  for (const team of teams) names.set(team.id, team.name)
  names.set(home.id, home.name)
  names.set(away.id, away.name)
  for (const item of fixtures) {
    if (item.homeTeam) names.set(item.homeTeamId, item.homeTeam.name)
    if (item.awayTeam) names.set(item.awayTeamId, item.awayTeam.name)
  }
  const nameFor = (teamId: string) => names.get(teamId)?.trim() || `Team ${teamId}`

  const summarize = (item: Fixture, subjectId: string): MatchStatsFixtureView => {
    const side = item.homeTeamId === subjectId ? 'HOME' : 'AWAY'
    const opponentId = side === 'HOME' ? item.awayTeamId : item.homeTeamId
    const score = scorePair(item.homeScore, item.awayScore)
    const result =
      item.status === 'FINISHED' && score
        ? side === 'HOME'
          ? resultFor(score.home, score.away)
          : resultFor(score.away, score.home)
        : null
    return {
      id: item.id,
      kickoffIso: item.kickoffUtc.toISOString(),
      kickoffLabel: formatMatchTime(item.kickoffUtc, timeZone),
      competitionId: item.competitionId,
      homeTeamId: item.homeTeamId,
      awayTeamId: item.awayTeamId,
      homeName: nameFor(item.homeTeamId),
      awayName: nameFor(item.awayTeamId),
      side,
      opponentName: nameFor(opponentId),
      score,
      result,
      status: item.status,
    }
  }

  const otherFixtures = fixtures.filter(item => item.id !== fixture.id)
  const finished = otherFixtures.filter(
    item => item.status === 'FINISHED' && scorePair(item.homeScore, item.awayScore) !== null,
  )
  const newestFirst = (a: Fixture, b: Fixture) =>
    b.kickoffUtc.getTime() - a.kickoffUtc.getTime()
  const oldestFirst = (a: Fixture, b: Fixture) =>
    a.kickoffUtc.getTime() - b.kickoffUtc.getTime()

  const h2h = finished
    .filter(
      item =>
        (item.homeTeamId === home.id && item.awayTeamId === away.id) ||
        (item.homeTeamId === away.id && item.awayTeamId === home.id),
    )
    .sort(newestFirst)
    .slice(0, 10)
    .map(item => summarize(item, home.id))

  const listsFor = (teamId: string) => {
    const involved = otherFixtures.filter(
      item => item.homeTeamId === teamId || item.awayTeamId === teamId,
    )
    return {
      recent: finished
        .filter(item => item.homeTeamId === teamId || item.awayTeamId === teamId)
        .sort(newestFirst)
        .slice(0, 5)
        .map(item => summarize(item, teamId)),
      upcoming: involved
        .filter(
          item =>
            item.status === 'LIVE' ||
            (item.status === 'SCHEDULED' && item.kickoffUtc.getTime() >= now.getTime()),
        )
        .sort(oldestFirst)
        .slice(0, 5)
        .map(item => summarize(item, teamId)),
    }
  }

  const homeLists = listsFor(home.id)
  const awayLists = listsFor(away.id)

  return {
    h2h,
    form: { home: features.home.form, away: features.away.form },
    team: { home: features.home, away: features.away },
    fullTime: scorePair(fixture.homeScore, fixture.awayScore),
    halfTime: scorePair(fixture.halfTimeHomeScore, fixture.halfTimeAwayScore),
    venue: fixture.venue ?? null,
    referee: fixture.referee ?? null,
    recent: { home: homeLists.recent, away: awayLists.recent },
    upcoming: { home: homeLists.upcoming, away: awayLists.upcoming },
  }
}
