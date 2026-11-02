import type { MatchView } from './view-model'

export interface SerializeOptions {
  includeExplanation: boolean
}

/**
 * Public API shape. Premium-only fields are omitted from the payload entirely,
 * not hidden client-side.
 */
export function serializeMatchView(view: MatchView, options: SerializeOptions) {
  return {
    id: view.id,
    competition: view.competition,
    competitionId: view.competitionId,
    sportId: view.sportId,
    status: view.status,
    home: view.home,
    away: view.away,
    kickoff: view.kickoffIso,
    kickoffLabel: view.kickoffLabel,
    score: view.score ?? null,
    probability: view.probability,
    expectedGoals: view.expectedGoals,
    marketOptions: view.marketOptions,
    topOutcome: view.topOutcome,
    qualityFlags: view.qualityFlags,
    form: view.form,
    modelVersion: view.modelVersion,
    dataAsOf: view.dataAsOfLabel,
    evaluation: view.evaluation,
    explanation: options.includeExplanation ? view.explanation : null,
  }
}
