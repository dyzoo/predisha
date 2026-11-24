import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Trophy, Users } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { EmptyState } from '@/components/intelligence/ui-states'
import { TeamBadge } from '@/components/teams/team-badge'
import { getMatchAnalyses } from '@/lib/sports/service'

export const metadata: Metadata = {
  title: 'Teams',
  description: 'Explore teams in the current fixture dataset, their competitions and recent fixtures.',
}

export default async function TeamsPage() {
  const { dataset } = await getMatchAnalyses()
  const competitions = new Map(dataset.competitions.map(competition => [competition.id, competition]))

  const teams = dataset.teams
    .map(team => {
      const fixtures = dataset.fixtures.filter(
        fixture => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id,
      )
      const competitionIds = Array.from(new Set(fixtures.map(fixture => fixture.competitionId)))
      const countries = Array.from(
        new Set(
          competitionIds
            .map(id => competitions.get(id)?.country)
            .filter((value): value is string => Boolean(value)),
        ),
      )
      const nextFixture = fixtures
        .filter(fixture => fixture.status === 'SCHEDULED' || fixture.status === 'LIVE')
        .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())[0]

      return { team, fixtures, competitionIds, countries, nextFixture }
    })
    .filter(item => item.fixtures.length > 0)
    .sort((a, b) => a.team.name.localeCompare(b.team.name))

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="intel-shell intel-section flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="intel-eyebrow">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Team directory
            </p>
            <h1 className="intel-title mt-3 break-words">Teams</h1>
            <p className="intel-subtitle mt-3">
              Open a team to see form, home and away records, competition position and fixture context.
              Squad, coach and detailed match events are omitted unless the data provider supplies them.
            </p>
          </div>
          <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <span className="intel-chip"><Users className="h-3 w-3" aria-hidden />{teams.length} teams in dataset</span>
          <Link href="/leagues" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            <Trophy className="h-3 w-3" aria-hidden />
            All competitions
          </Link>
          <Link href="/matches" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            <CalendarDays className="h-3 w-3" aria-hidden />
            All fixtures
          </Link>
        </div>

        {teams.length === 0 ? (
          <EmptyState
            className="mt-8"
            title="No teams are connected"
            description="Connect a football data provider or run a sync to populate the team directory."
          />
        ) : (
          <div className="intel-grid mt-6">
            {teams.map(({ team, fixtures, competitionIds, countries, nextFixture }) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="intel-panel group flex min-w-0 items-start gap-3 p-4 transition-colors hover:border-accent-line"
              >
                <TeamBadge team={{ ...team, short: team.shortName }} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-display text-base font-bold leading-snug group-hover:text-accent">
                    {team.name}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-text">
                    {countries.length > 0 ? countries.join(' · ') : competitionIds.map(id => competitions.get(id)?.name).filter(Boolean).join(' · ') || 'Competition not supplied'}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-text">{fixtures.length} fixtures in dataset</p>
                  {nextFixture ? (
                    <p className="mt-1 truncate text-[11px] text-muted-text">
                      Next: {competitions.get(nextFixture.competitionId)?.name ?? 'Fixture'} · {nextFixture.kickoffUtc.toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-text transition-colors group-hover:text-accent" aria-hidden />
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
