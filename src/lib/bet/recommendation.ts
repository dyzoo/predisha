import { buildPredictionSlip } from '@/lib/predictions/builder'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { marketIdForOutcomeKey, marketNameForId, oddsForProbability } from './odds'

export const MIN_RECOMMENDED_PICKS = 15
export const MAX_RECOMMENDED_PICKS = 20

export interface AdminRecommendationPick {
  fixtureId: string
  fixtureLabel: string
  competition: string
  kickoffLabel: string
  kickoffIso: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: number
  probability: number
  riskLevel: string
}

export interface AdminSlipRecommendation {
  picks: AdminRecommendationPick[]
  generatedAt: string
  demo: boolean
  modelVersion: string | null
}

/**
 * Builds the model's strongest upcoming picks for the admin slip generator.
 * One selection per fixture, ranked by the same probability/risk scoring used
 * by the customer prediction builder. Admins only adjust the offered odds.
 */
export async function buildAdminSlipRecommendation(
  options: { now?: Date; minPicks?: number } = {},
): Promise<AdminSlipRecommendation> {
  const at = options.now ?? new Date()
  const { analyses, dataset } = await getMatchAnalyses(at)
  const wanted = Math.min(
    MAX_RECOMMENDED_PICKS,
    Math.max(MIN_RECOMMENDED_PICKS, options.minPicks ?? MIN_RECOMMENDED_PICKS),
  )

  const result = buildPredictionSlip(
    analyses.map(analysis => toMatchView(analysis, 'UTC', at)),
    {
      stake: 1000,
      risk: 'balanced',
      maxProbability: 0.85,
      odds: null,
      maxSelections: MAX_RECOMMENDED_PICKS,
      selectionCount: wanted,
      currency: 'TZS',
      demo: dataset.isDemo,
      premium: true,
      limited: false,
    },
  )

  if (!result) {
    return {
      picks: [],
      generatedAt: at.toISOString(),
      demo: dataset.isDemo,
      modelVersion: null,
    }
  }

  const picks = result.selections.flatMap(selection => {
    const marketId = marketIdForOutcomeKey(selection.outcomeKey)
    if (!marketId) return []
    return [
      {
        fixtureId: selection.fixtureId,
        fixtureLabel: `${selection.homeName} vs ${selection.awayName}`,
        competition: selection.competition,
        kickoffLabel: selection.kickoffLabel,
        kickoffIso: selection.kickoffIso,
        marketId,
        marketName: marketNameForId(marketId),
        selectionId: selection.outcomeKey,
        selectionLabel: selection.outcomeLabel,
        odds: oddsForProbability(selection.probability),
        probability: selection.probability,
        riskLevel: selection.riskLevel,
      },
    ]
  })

  return {
    picks,
    generatedAt: result.generatedAt,
    demo: dataset.isDemo,
    modelVersion: result.selections[0]?.modelVersion ?? null,
  }
}
