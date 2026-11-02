import { json } from '@/lib/api'
import { getViewer } from '@/lib/auth/session'
import { previewLimit } from '@/lib/auth/entitlements'
import { rankPredictions, MODEL_CONFIG } from '@/lib/predictions/engine'
import { getMatchAnalyses } from '@/lib/sports/service'
import { serializeMatchView } from '@/lib/sports/serialize'
import { toMatchView } from '@/lib/sports/view-model'

export async function GET() {
  const viewer = await getViewer()
  const { analyses, dataset } = await getMatchAnalyses()
  const upcoming = analyses
    .map(analysis => toMatchView(analysis))
    .filter(match => match.status === 'SCHEDULED' && match.probability && match.topOutcome)

  const ranked = rankPredictions(
    upcoming.map(match => ({
      match,
      probability: match.topOutcome!.probability,
      modelVersion: match.modelVersion ?? 'unknown',
      qualityFlags: match.qualityFlags,
    })),
  )

  const limit = previewLimit(viewer, dataset.isDemo)
  const limited = limit === null ? ranked : ranked.slice(0, limit)

  return json({
    data: limited.map(item =>
      serializeMatchView(item.match, { includeExplanation: false }),
    ),
    meta: {
      total: ranked.length,
      returned: limited.length,
      limited: limit !== null && ranked.length > limit,
      previewLimit: limit,
      rankingRule: `Top-outcome probability >= ${MODEL_CONFIG.rankingMinimumProbability}; no blocking data-quality flags; highest probability first.`,
      demo: dataset.isDemo,
      provider: dataset.health.mode,
      disclaimer: 'A high probability is not a guaranteed result or betting advice.',
    },
  })
}
