import { formatInTimeZone } from 'date-fns-tz'
import type { FormResult, MarketOption, OutcomeKey } from '@/lib/predictions/engine'
import type { FixtureStatus } from './provider'
import type { MatchAnalysis } from './service'

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

  const hasScore =
    typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'
  const kickoffPassed = fixture.kickoffUtc.getTime() < at.getTime()

  let effectiveStatus: FixtureStatus = fixture.status
  if (hasScore) {
    effectiveStatus = 'FINISHED'
  } else if (kickoffPassed && fixture.status === 'SCHEDULED') {
    effectiveStatus = 'FINISHED'
  } else if (kickoffPassed && fixture.status === 'LIVE') {
    effectiveStatus = 'FINISHED'
  }

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
    score:
      typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'
        ? { home: fixture.homeScore, away: fixture.awayScore }
        : undefined,
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
