import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MatchExplorer } from '@/components/matches/match-explorer'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Matches',
  description: 'Live and upcoming football fixtures with transparent predictions.',
}

export default async function MatchesPage() {
  const { analyses, dataset } = await getMatchAnalyses()
  const matches = analyses.map(analysis => toMatchView(analysis))
  const competitions = dataset.competitions.map(competition => ({
    id: competition.id,
    name: competition.name,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1 pt-6 sm:pt-10">
        <MatchExplorer
          matches={matches}
          competitions={competitions}
          isDemo={dataset.isDemo}
          providerMessage={dataset.health.message}
          providerOk={dataset.health.ok}
        />
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
