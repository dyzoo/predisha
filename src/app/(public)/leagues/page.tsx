import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Trophy } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { StatusBadge } from '@/components/intelligence/status-badge'
import { getMatchAnalyses } from '@/lib/sports/service'

export const metadata = {
  title: 'Competitions',
  description: 'Browse available football competitions, seasons and fixture coverage.',
}

export default async function CompetitionsPage() {
  const { dataset, analyses } = await getMatchAnalyses()

  const competitions = dataset.competitions
    .map(competition => {
      const fixtures = analyses.filter(analysis => analysis.competition.id === competition.id)
      const teams = new Set(fixtures.flatMap(match => [match.home.id, match.away.id]))
      return { competition, fixtures: fixtures.length, teams: teams.size }
    })
    .sort((a, b) => b.fixtures - a.fixtures || a.competition.name.localeCompare(b.competition.name))

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="intel-shell intel-section flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="intel-eyebrow">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Competitions
            </p>
            <h1 className="intel-title mt-3">Explore the leagues behind the fixtures</h1>
            <p className="intel-subtitle mt-4">
              Open a competition for standings, fixtures and team context. Coverage follows the
              connected data provider; unavailable information is never invented.
            </p>
          </div>
          <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
        </div>

        {competitions.length === 0 ? (
          <div className="intel-empty mt-8">
            <p className="font-semibold text-main-text">No competitions connected</p>
            <p>Connect a football data provider or sync fixtures to see competition hubs here.</p>
          </div>
        ) : (
          <div className="intel-grid mt-8">
            {competitions.map(({ competition, fixtures, teams }) => (
              <Link
                key={competition.id}
                href={`/leagues/${competition.id}`}
                className="intel-panel group flex min-w-0 flex-col p-5 transition-colors hover:border-accent-line"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-text">
                      {competition.country ?? 'International'}
                    </p>
                    <h2 className="mt-2 break-words font-display text-lg font-bold leading-snug">
                      {competition.name}
                    </h2>
                    <p className="mt-2 text-xs text-muted-text">{competition.season ?? 'Current season'}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-accent opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="intel-chip">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {fixtures} fixtures
                  </span>
                  <span className="intel-chip">{teams} teams</span>
                  {dataset.isDemo ? <StatusBadge kind="DEMO" /> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
