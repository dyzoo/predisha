import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MatchExplorer } from '@/components/matches/match-explorer'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'League fixtures',
}

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const { analyses, dataset } = await getMatchAnalyses()
  const competition = dataset.competitions.find(item => item.id === leagueId)

  if (!competition) notFound()

  const matches = analyses
    .filter(analysis => analysis.competition.id === competition.id)
    .map(analysis => toMatchView(analysis))

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1 pt-6 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Competition</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {competition.name}
          </h1>
          <p className="mt-2 text-sm text-muted-text">
            {competition.country ?? 'International'} · {competition.season ?? 'Current season'}
          </p>
        </div>
        <MatchExplorer
          matches={matches}
          competitions={[{ id: competition.id, name: competition.name }]}
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
