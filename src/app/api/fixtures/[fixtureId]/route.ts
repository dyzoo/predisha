import { apiError, json } from '@/lib/api'
import { getMatchAnalysis } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { serializeMatchView } from '@/lib/sports/serialize'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params
  const { analysis, dataset } = await getMatchAnalysis(fixtureId)
  if (!analysis) return apiError('Fixture not found.', 404)

  return json({
    data: {
      ...serializeMatchView(toMatchView(analysis), { includeExplanation: false }),
      competition: analysis.competition,
      sport: analysis.sport,
      predictionStatus: analysis.prediction ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    },
    meta: { demo: dataset.isDemo, provider: dataset.health.mode },
  })
}
