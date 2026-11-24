import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Trophy, Users } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CompetitionHub } from '@/components/intelligence/competition-hub'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { FixtureRows } from '@/components/intelligence/fixture-rows'
import { StandingsTable, type StandingsRow } from '@/components/intelligence/standings-table'
import { StatusBadge } from '@/components/intelligence/status-badge'
import { getMatchAnalyses } from '@/lib/sports/service'
import { getCompetitionStandings } from '@/lib/sports/standings-service'
import { toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Competition hub',
  description: 'Standings, fixtures and team context for a football competition.',
}

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const { analyses, dataset } = await getMatchAnalyses()
  const competition = dataset.competitions.find(item => item.id === leagueId)

  if (!competition) notFound()

  const competitionAnalyses = analyses.filter(analysis => analysis.competition.id === competition.id)
  const competitionViews = competitionAnalyses.map(analysis => toMatchView(analysis))
  const standings = await getCompetitionStandings(competition.id, competition.providerId)

  const teamsById = new Map(dataset.teams.map(team => [team.id, team]))
  const providerTeamIds = new Map(
    dataset.teams
      .filter(team => team.providerId)
      .map(team => [team.providerId as string, team.id]),
  )

  const standingsRows: StandingsRow[] = standings.rows.map(row => {
    const localTeamId =
      providerTeamIds.get(row.teamId) ??
      dataset.teams.find(team => team.name.toLowerCase() === row.teamName.toLowerCase())?.id ??
      null
    const localTeam = localTeamId ? teamsById.get(localTeamId) : null
    return {
      ...row,
      localTeamId,
      color: localTeam?.color ?? null,
      logoUrl: localTeam?.logoUrl ?? row.logoUrl,
    }
  })

  const live = competitionViews.filter(match => match.effectiveStatus === 'LIVE')
  const upcoming = competitionViews
    .filter(match => match.effectiveStatus === 'SCHEDULED')
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime())
  const finished = competitionViews
    .filter(match => match.effectiveStatus === 'FINISHED')
    .sort((a, b) => new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime())
  const analysed = competitionViews.filter(match => match.probability !== null)
  const teamCount = new Set(competitionAnalyses.flatMap(match => [match.home.id, match.away.id])).size

  const overview = (
    <div className="grid gap-4">
      <div className="intel-grid">
        {[
          { label: 'Fixtures', value: competitionViews.length, icon: CalendarDays },
          { label: 'Teams', value: teamCount, icon: Users },
          { label: 'Analysed', value: analysed.length, icon: Trophy },
        ].map(stat => (
          <div key={stat.label} className="intel-panel-quiet flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-text">{stat.label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{stat.value}</p>
            </div>
            <stat.icon className="h-5 w-5 text-accent" aria-hidden />
          </div>
        ))}
      </div>

      <div className="intel-panel p-5">
        <h2 className="font-display text-lg font-bold">Next fixtures</h2>
        <p className="mt-1 text-xs text-muted-text">The nearest fixtures in this competition dataset.</p>
        <div className="mt-4">
          <FixtureRows matches={upcoming} showCompetition={false} limit={5} emptyMessage="No upcoming fixtures are available for this competition." />
        </div>
      </div>

      <div className="intel-panel p-5">
        <h2 className="font-display text-lg font-bold">Teams to explore</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from(
            new Map(
              competitionAnalyses.flatMap(match => [
                [match.home.id, match.home],
                [match.away.id, match.away],
              ]),
            ).values(),
          ).map(team => (
            <Link key={team.id} href={`/teams/${team.id}`} className="intel-chip intel-link hover:border-accent-line hover:text-accent">
              <ArrowUpRight className="h-3 w-3" aria-hidden />
              {team.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )

  const standingsPanel = (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">League table</h2>
          <p className="mt-1 text-xs text-muted-text">{standings.message}</p>
        </div>
        {standings.source === 'football-data' ? <StatusBadge kind="ESTIMATED" label="Provider data" /> : <StatusBadge kind="UNAVAILABLE" />}
      </div>
      <StandingsTable rows={standingsRows} />
      {standings.retrievedAt ? (
        <p className="text-[11px] text-muted-text">Retrieved {new Date(standings.retrievedAt).toLocaleString()}. Cached for 15 minutes.</p>
      ) : null}
    </div>
  )

  const fixturesPanel = (
    <div className="grid gap-5">
      <section>
        <h2 className="font-display text-lg font-bold">Live & upcoming</h2>
        <div className="mt-3">
          <FixtureRows matches={[...live, ...upcoming]} showCompetition={false} limit={10} emptyMessage="No live or upcoming fixtures are currently available." />
        </div>
      </section>
      <section>
        <h2 className="font-display text-lg font-bold">Recent results</h2>
        <div className="mt-3">
          <FixtureRows matches={finished} showCompetition={false} limit={10} emptyMessage="No finished fixtures are available in the current dataset." />
        </div>
      </section>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="intel-shell intel-section flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="intel-eyebrow">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Competition hub
            </p>
            <h1 className="intel-title mt-3 break-words">{competition.name}</h1>
            <p className="mt-3 text-sm text-muted-text">
              {competition.country ?? 'International'} · {competition.season ?? 'Current season'}
            </p>
          </div>
          <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
        </div>

        <CompetitionHub
          overview={overview}
          standings={standingsPanel}
          fixtures={fixturesPanel}
          initialTab={standingsRows.length > 0 ? 'standings' : 'overview'}
        />
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
