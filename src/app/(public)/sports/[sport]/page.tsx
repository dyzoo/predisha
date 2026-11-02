import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MatchExplorer } from '@/components/matches/match-explorer'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Sport fixtures',
}

export default async function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params
  const { analyses, dataset } = await getMatchAnalyses()
  const sportRecord = dataset.sportList.find(item => item.slug === sport || item.id === sport)

  if (!sportRecord) notFound()

  const matches = analyses
    .filter(analysis => analysis.sport.id === sportRecord.id)
    .map(analysis => toMatchView(analysis))
  const competitions = dataset.competitions
    .filter(competition => competition.sportId === sportRecord.id)
    .map(competition => ({ id: competition.id, name: competition.name }))

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
