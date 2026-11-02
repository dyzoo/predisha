import { rankPredictions } from '@/lib/predictions/engine'
import { buildMatchAnalyses, getSportsDataset } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

async function main() {
  const now = new Date()
  const dataset = await getSportsDataset(now)
  const analyses = buildMatchAnalyses(dataset, now)
  console.log(`dataset: fixtures=${dataset.fixtures.length}, teams=${dataset.teams.length}, isDemo=${dataset.isDemo}, health=${dataset.health.mode}`)

  const upcoming = analyses.filter(item => item.fixture.kickoffUtc.getTime() > now.getTime())
  const scheduled = upcoming.filter(item => item.fixture.status === 'SCHEDULED')
  const withPrediction = scheduled.filter(item => item.prediction !== null)
  console.log(`upcoming=${upcoming.length}, scheduled=${scheduled.length}, scheduledWithPrediction=${withPrediction.length}`)

  const views = analyses.map(item => toMatchView(item))
  const eligible = views.filter(
    view =>
      view.status === 'SCHEDULED' &&
      view.probability !== null &&
      view.topOutcome !== null,
  )
  const ranked = rankPredictions(
    eligible.map(view => ({
      match: view,
      probability: view.topOutcome!.probability,
      modelVersion: view.modelVersion ?? 'unknown',
      qualityFlags: view.qualityFlags,
    })),
  )
  console.log(`eligible=${eligible.length}, ranked=${ranked.length}`)

  for (const view of eligible.slice(0, 12)) {
    console.log(
      `${view.kickoffLabel} | ${view.home.name} vs ${view.away.name} | status=${view.status} | p=${view.topOutcome?.probability.toFixed(3)} | flags=${view.qualityFlags.join(',') || 'none'}`,
    )
  }
}

main()
  .catch(error => {
    console.error('diagnose failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))
