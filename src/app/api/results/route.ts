import { json } from '@/lib/api'
import { getMatchAnalyses, summarizeEvaluations } from '@/lib/sports/service'
import { serializeMatchView } from '@/lib/sports/serialize'
import { toMatchView } from '@/lib/sports/view-model'

export async function GET() {
  const { analyses, dataset } = await getMatchAnalyses()
  const evaluated = analyses
    .filter(analysis => analysis.fixture.status === 'FINISHED' && analysis.evaluation)
    .map(analysis => toMatchView(analysis))
    .sort((a, b) => new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime())

  return json({
    data: evaluated.map(view => serializeMatchView(view, { includeExplanation: false })),
    summary: summarizeEvaluations(analyses),
    meta: {
      demo: dataset.isDemo,
      provider: dataset.health.mode,
      excluded: 'Postponed, cancelled and abandoned fixtures are excluded from evaluation.',
      disclaimer: 'These metrics describe model calibration, not profitability.',
    },
  })
}
