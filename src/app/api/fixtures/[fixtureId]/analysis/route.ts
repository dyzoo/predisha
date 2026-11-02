import { apiError, json } from '@/lib/api'
import { getViewer } from '@/lib/auth/session'
import { canViewPremium } from '@/lib/auth/entitlements'
import { getMatchAnalysis } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { serializeMatchView } from '@/lib/sports/serialize'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params
  const viewer = await getViewer()
  const { analysis, dataset } = await getMatchAnalysis(fixtureId)
  if (!analysis) return apiError('Fixture not found.', 404)

  const includePremium = canViewPremium(viewer) || dataset.isDemo
  const { prediction, features, evaluation } = analysis
  const view = toMatchView(analysis)

  return json({
    data: {
      fixture: {
        ...serializeMatchView(view, { includeExplanation: false }),
        competition: analysis.competition,
        sport: analysis.sport,
      },
      prediction: prediction
        ? {
            market: prediction.market,
            outcomes: prediction.outcomes,
            marketOptions: prediction.marketOptions ?? [],
            modelVersion: prediction.modelVersion,
            modelName: prediction.modelName,
            generatedAt: prediction.generatedAt,
            inputDataAsOf: prediction.inputDataAsOf,
            expectedGoals: {
              home: prediction.homeExpectedGoals,
              away: prediction.awayExpectedGoals,
            },
            qualityFlags: prediction.qualityFlags,
            structuredFacts: includePremium ? prediction.structuredFacts : undefined,
            explanation: includePremium ? analysis.explanation : undefined,
          }
        : null,
      sample: {
        homeMatches: features.home.matches,
        awayMatches: features.away.matches,
        form: includePremium
          ? { home: features.home.form, away: features.away.form }
          : undefined,
      },
      evaluation,
    },
    meta: {
      demo: dataset.isDemo,
      provider: dataset.health.mode,
      premium: includePremium,
      message: prediction
        ? 'Probabilities are estimates, not certainties or betting advice.'
        : 'Insufficient data for a reliable estimate.',
    },
  })
}
