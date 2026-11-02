import type { MarketOption, MarketRisk } from './engine'
import type { MatchView } from '@/lib/sports/view-model'
import {
  BUILDER_RISK_CONFIG,
  percent,
  type BuilderResult,
  type BuilderRisk,
  type BuilderSelection,
} from './builder-types'

export interface BuildSlipOptions {
  stake: number
  risk: BuilderRisk
  odds?: number | null
  maxSelections: number
  currency: string
  demo: boolean
  premium: boolean
  limited: boolean
}

const RISK_TARGET_PROBABILITY: Record<BuilderRisk, number> = {
  conservative: 0.78,
  balanced: 0.65,
  aggressive: 0.52,
}

const RISK_MINIMUM_PROBABILITY: Record<BuilderRisk, number> = {
  conservative: 0.58,
  balanced: 0.48,
  aggressive: 0.4,
}

const BLOCKING_FLAGS = new Set(['LOW_SAMPLE', 'STALE_INPUT', 'MISSING_INPUT'])

function fallbackOptions(match: MatchView): MarketOption[] {
  if (match.marketOptions.length > 0) return match.marketOptions
  if (!match.probability) return []
  return [
    {
      key: 'HOME' as const,
      market: '1X2',
      label: 'Home win',
      shortLabel: 'Home',
      probability: match.probability.home,
      impliedOdds: match.probability.home > 0 ? 1 / match.probability.home : 0,
      risk: match.probability.home >= 0.72 ? 'low' : match.probability.home >= 0.56 ? 'medium' : 'high',
    },
    {
      key: 'DRAW' as const,
      market: '1X2',
      label: 'Draw',
      shortLabel: 'Draw',
      probability: match.probability.draw,
      impliedOdds: match.probability.draw > 0 ? 1 / match.probability.draw : 0,
      risk: match.probability.draw >= 0.72 ? 'low' : match.probability.draw >= 0.56 ? 'medium' : 'high',
    },
    {
      key: 'AWAY' as const,
      market: '1X2',
      label: 'Away win',
      shortLabel: 'Away',
      probability: match.probability.away,
      impliedOdds: match.probability.away > 0 ? 1 / match.probability.away : 0,
      risk: match.probability.away >= 0.72 ? 'low' : match.probability.away >= 0.56 ? 'medium' : 'high',
    },
  ]
}

function scoreOption(option: MarketOption, risk: BuilderRisk): number {
  const target = RISK_TARGET_PROBABILITY[risk]
  const odds = option.probability > 0 ? 1 / option.probability : 0
  let score = option.probability * 100 - Math.abs(option.probability - target) * 85

  if (risk === 'conservative') {
    if (option.risk === 'low') score += 12
    if (option.risk === 'high') score -= 10
    score -= Math.max(0, odds - 1.65) * 12
  } else if (risk === 'balanced') {
    if (option.risk === 'low') score += 4
    if (option.risk === 'high') score -= 3
    score -= Math.abs(odds - 1.75) * 5
  } else {
    score += Math.min(odds, 3.4) * 7
    if (option.risk === 'high') score += 4
  }

  return score
}

function reasonFor(match: MatchView, option: MarketOption): string {
  const goals = match.expectedGoals
  const goalContext = goals
    ? `Projected goals: ${goals.home.toFixed(2)} home and ${goals.away.toFixed(2)} away.`
    : 'The option comes from the model score distribution.'

  if (option.key === 'DC_HOME_DRAW' || option.key === 'DC_DRAW_AWAY' || option.key === 'DC_HOME_AWAY') {
    return `Double chance covers two results and raises the model hit probability to ${percent(option.probability)}. ${goalContext}`
  }
  if (option.key === 'OVER_1_5' || option.key === 'OVER_2_5' || option.key === 'UNDER_3_5') {
    return `${option.label} is priced at ${percent(option.probability)} from the full score distribution. ${goalContext}`
  }
  if (option.key === 'BTTS_YES' || option.key === 'BTTS_NO') {
    return `${option.label} carries a ${percent(option.probability)} model probability. ${goalContext}`
  }
  return `${option.label} is the strongest single-result option at ${percent(option.probability)}. ${goalContext}`
}

function hasCorrelation(selections: BuilderSelection[]): { correlated: boolean; reason: string } {
  const fixtureIds = selections.map(s => s.fixtureId)
  const uniqueFixtures = new Set(fixtureIds)
  if (fixtureIds.length !== uniqueFixtures.size) {
    return { correlated: true, reason: 'Multiple selections from the same fixture increase correlation risk.' }
  }
  // Check same competition and close kickoff times as basic correlation proxy
  for (let i = 0; i < selections.length; i++) {
    for (let j = i + 1; j < selections.length; j++) {
      if (selections[i].fixtureId === selections[j].fixtureId) {
        return { correlated: true, reason: 'Same fixture selection detected.' }
      }
    }
  }
  return { correlated: false, reason: '' }
}

function alternativesFor(match: MatchView, selected: MarketOption): BuilderSelection['alternatives'] {
  return fallbackOptions(match)
    .filter(option => option.key !== selected.key && option.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map(option => ({
      label: option.label,
      market: option.market,
      probability: option.probability,
    }))
}

interface Candidate {
  match: MatchView
  option: MarketOption
  score: number
}

function bestCandidate(match: MatchView, risk: BuilderRisk): Candidate | null {
  const minimum = RISK_MINIMUM_PROBABILITY[risk]
  const options = fallbackOptions(match).filter(
    option => Number.isFinite(option.probability) && option.probability >= minimum,
  )
  const pool = options.length > 0 ? options : fallbackOptions(match)
  if (pool.length === 0) return null

  const option = pool.reduce((best, current) =>
    scoreOption(current, risk) > scoreOption(best, risk) ? current : best,
  )
  return { match, option, score: scoreOption(option, risk) }
}

/**
 * Builds a transparent combination from the model's best options. Every
 * eligible fixture contributes one selection, with 1X2, double chance, totals
 * and both-teams-to-score markets compared under the chosen risk profile.
 */
export function buildPredictionSlip(
  matches: MatchView[],
  options: BuildSlipOptions,
): BuilderResult | null {
  const eligible = matches.filter(
    match =>
      match.effectiveStatus === 'SCHEDULED' &&
      match.probability !== null &&
      !match.qualityFlags.some(flag => BLOCKING_FLAGS.has(flag)),
  )

  const candidates = eligible
    .map(match => bestCandidate(match, options.risk))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .sort((a, b) => b.score - a.score)

  // Add variety: shuffle candidates whose scores are within 1 point so the
  // same top picks don't dominate every slip, while keeping the strongest
  // options ranked first.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor((i + 1) * Math.random())
    if (Math.abs(candidates[i].score - candidates[j].score) <= 1) {
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
  }

  const wanted = Math.min(
    BUILDER_RISK_CONFIG[options.risk].selections,
    options.maxSelections,
  )
  const chosen = candidates.slice(0, wanted)
  if (chosen.length === 0) return null

  const selections: BuilderSelection[] = chosen.map(({ match, option }) => {
    return {
      fixtureId: match.id,
      competition: match.competition,
      kickoffIso: match.kickoffIso,
      kickoffLabel: match.kickoffLabel,
      homeName: match.home.name,
      awayName: match.away.name,
      homeShort: match.home.short,
      awayShort: match.away.short,
      homeColor: match.home.color,
      awayColor: match.away.color,
      homeLogoUrl: match.home.logoUrl,
      awayLogoUrl: match.away.logoUrl,
      modelVersion: match.modelVersion,
      market: option.market,
      outcomeKey: option.key,
      outcomeLabel: option.label,
      riskLevel: option.risk as MarketRisk,
      reason: reasonFor(match, option),
      alternatives: alternativesFor(match, option),
      probability: option.probability,
      impliedOdds: option.probability > 0 ? 1 / option.probability : 0,
      homeProbability: match.probability?.home ?? 0,
      drawProbability: match.probability?.draw ?? 0,
      awayProbability: match.probability?.away ?? 0,
      dataAsOf: match.dataAsOfLabel,
      dataAsOfIso: match.dataAsOfIso,
      qualityFlags: match.qualityFlags,
    }
  })

  const impliedCombinedOdds = selections.reduce(
    (total, selection) => total * selection.impliedOdds,
    1,
  )
  const combinedProbability = selections.reduce(
    (total, selection) => total * selection.probability,
    1,
  )
  const hasUserOdds =
    typeof options.odds === 'number' &&
    Number.isFinite(options.odds) &&
    options.odds >= 1
  const usedOdds = hasUserOdds ? (options.odds as number) : impliedCombinedOdds
  const potentialReturn = options.stake * usedOdds
  const dataAsOf =
    selections.find(selection => selection.dataAsOf)?.dataAsOf ?? null
  const dataAsOfIso =
    selections.find(selection => selection.dataAsOfIso)?.dataAsOfIso ?? null

  const correlation = hasCorrelation(selections)
  return {
    stake: options.stake,
    currency: options.currency,
    risk: options.risk,
    selections,
    impliedCombinedOdds,
    usedOdds,
    oddsSource: hasUserOdds ? 'user' : 'model-implied',
    combinedProbability,
    potentialReturn,
    netProfit: potentialReturn - options.stake,
    generatedAt: new Date().toISOString(),
    dataAsOf,
    dataAsOfIso,
    demo: options.demo,
    premium: options.premium,
    limited: options.limited,
    maxSelections: options.maxSelections,
    correlationWarning: correlation.correlated ? correlation.reason : undefined,
  }
}
