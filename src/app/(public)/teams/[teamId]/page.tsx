import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, CalendarClock, CircleAlert, MapPin, Trophy, Users } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { FixtureRows } from '@/components/intelligence/fixture-rows'
import { StatusBadge } from '@/components/intelligence/status-badge'
import { TeamFormStrip } from '@/components/intelligence/team-form-strip'
import { TeamBadge } from '@/components/teams/team-badge'
import { getMatchAnalyses } from '@/lib/sports/service'
import { getCompetitionStandings } from '@/lib/sports/standings-service'
import { toMatchView } from '@/lib/sports/view-model'
import type { Fixture } from '@/lib/sports/provider'

export const metadata: Metadata = {
  title: 'Team profile',
  description: 'Team context, recent form, upcoming fixtures and competition position.',
}

type TeamSummary = {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  form: string[]
}

function summarizeTeam(fixtures: Fixture[], teamId: string): TeamSummary {
  const finished = fixtures
    .filter(fixture => fixture.status === 'FINISHED' && typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number')
    .sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime())

  const summary: TeamSummary = {
    played: finished.length,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    form: [],
  }

  for (const fixture of finished) {
    const isHome = fixture.homeTeamId === teamId
    const scored = isHome ? fixture.homeScore ?? 0 : fixture.awayScore ?? 0
    const conceded = isHome ? fixture.awayScore ?? 0 : fixture.homeScore ?? 0
    summary.goalsFor += scored
    summary.goalsAgainst += conceded
    const result = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D'
    if (result === 'W') summary.wins += 1
    if (result === 'D') summary.draws += 1
    if (result === 'L') summary.losses += 1
    if (summary.form.length < 10) summary.form.push(result)
  }

  return summary
}

function splitByVenue(fixtures: Fixture[], teamId: string, side: 'HOME' | 'AWAY') {
  return fixtures.filter(
    fixture =>
      fixture.status === 'FINISHED' &&
      typeof fixture.homeScore === 'number' &&
      typeof fixture.awayScore === 'number' &&
      (side === 'HOME' ? fixture.homeTeamId === teamId : fixture.awayTeamId === teamId),
  )
}

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const { analyses, dataset } = await getMatchAnalyses()
  const team = dataset.teams.find(item => item.id === teamId)

  if (!team) notFound()

  const teamFixtures = dataset.fixtures
    .filter(fixture => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId)
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())

  if (teamFixtures.length === 0) notFound()

  const finished = teamFixtures
    .filter(fixture => fixture.status === 'FINISHED')
    .sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime())
  const upcoming = teamFixtures
    .filter(fixture => fixture.status === 'SCHEDULED' || fixture.status === 'LIVE')
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())

  const overall = summarizeTeam(teamFixtures, teamId)
  const home = summarizeTeam(splitByVenue(teamFixtures, teamId, 'HOME'), teamId)
  const away = summarizeTeam(splitByVenue(teamFixtures, teamId, 'AWAY'), teamId)

  const competitionIds = Array.from(new Set(teamFixtures.map(fixture => fixture.competitionId))).slice(0, 4)
  const competitionData = await Promise.all(
    competitionIds.map(async competitionId => {
      const competition = dataset.competitions.find(item => item.id === competitionId)
      if (!competition) return null
      const standings = await getCompetitionStandings(competition.id, competition.providerId)
      const row =
        standings.rows.find(item => item.teamId === team.providerId) ??
        standings.rows.find(item => item.teamName.toLowerCase() === team.name.toLowerCase()) ??
        null
      return { competition, standings, row }
    }),
  )

  const positionRows = competitionData.flatMap(item => {
    if (!item?.row) return []
    return [
      {
        competition: item.competition,
        row: item.row,
        retrievedAt: item.standings.retrievedAt,
      },
    ]
  })

  const venueCounts = new Map<string, number>()
  for (const fixture of teamFixtures) {
    if (!fixture.venue) continue
    venueCounts.set(fixture.venue, (venueCounts.get(fixture.venue) ?? 0) + 1)
  }
  const venue = Array.from(venueCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const countries = Array.from(
    new Set(
      teamFixtures
        .map(fixture => dataset.competitions.find(item => item.id === fixture.competitionId)?.country)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const matchViews = analyses
    .filter(analysis => analysis.home.id === teamId || analysis.away.id === teamId)
    .map(analysis => toMatchView(analysis))
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime())

  const homeMatches = matchViews.filter(match => match.home.id === teamId)
  const awayMatches = matchViews.filter(match => match.away.id === teamId)

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="intel-shell intel-section flex-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/teams" className="intel-link inline-flex items-center gap-2 text-xs font-semibold">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All teams
          </Link>
          <Link href="/leagues" className="intel-link text-xs font-semibold">
            All competitions
          </Link>
        </div>

        <header className="intel-panel mt-5 overflow-hidden">
          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 items-start gap-4">
              <TeamBadge team={{ ...team, short: team.shortName }} size="xl" className="!h-16 !w-16 sm:!h-20 sm:!w-20" />
              <div className="min-w-0">
                <p className="intel-eyebrow">Team profile</p>
                <h1 className="mt-2 break-words font-display text-2xl font-bold leading-tight sm:text-4xl">
                  {team.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-text">
                  {countries.length > 0 ? <span className="intel-chip">{countries.join(' · ')}</span> : null}
                  <span className="intel-chip">{teamFixtures.length} fixtures in dataset</span>
                  {dataset.isDemo ? <StatusBadge kind="DEMO" /> : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {[
                { label: 'Played', value: overall.played },
                { label: 'Won', value: overall.wins },
                { label: 'Drawn', value: overall.draws },
                { label: 'Lost', value: overall.losses },
              ].map(stat => (
                <div key={stat.label} className="intel-panel-quiet p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border px-5 py-4 text-xs text-muted-text sm:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                {positionRows.length > 0
                  ? positionRows.map(item => `${item.competition.name}: ${item.row.position}${item.row.points != null ? ` · ${item.row.points} pts` : ''}`).join('  |  ')
                  : 'League position unavailable from current data'}
              </span>
            </div>
            {venue ? (
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0">{venue}</span>
              </span>
            ) : null}
          </div>
        </header>

        <div className="intel-grid mt-6">
          <section className="intel-panel p-5">
            <h2 className="font-display text-lg font-bold">Season form</h2>
            <p className="mt-1 text-xs text-muted-text">Most recent results first. W / D / L is from this team&apos;s perspective.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TeamFormStrip form={overall.form.slice(0, 5)} label="Last 5" />
              {overall.form.length >= 10 ? (
                <TeamFormStrip form={overall.form.slice(0, 10)} label="Last 10" />
              ) : null}
            </div>
            <dl className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
              {[
                ['Goals for', overall.goalsFor],
                ['Goals against', overall.goalsAgainst],
                ['Goal difference', overall.goalsFor - overall.goalsAgainst],
                ['Goals per match', overall.played > 0 ? (overall.goalsFor / overall.played).toFixed(2) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                  <dt className="text-muted-text">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="intel-panel p-5">
            <h2 className="font-display text-lg font-bold">Home & away</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Home', summary: home },
                { label: 'Away', summary: away },
              ].map(item => (
                <div key={item.label} className="intel-panel-quiet p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-text">{item.label}</p>
                  <p className="mt-2 font-display text-xl font-bold tabular-nums">
                    {item.summary.wins}-{item.summary.draws}-{item.summary.losses}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-text">
                    {item.summary.goalsFor} scored · {item.summary.goalsAgainst} conceded
                  </p>
                  <div className="mt-3"><TeamFormStrip form={item.summary.form.slice(0, 5)} compact /></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Recent results</h2>
            <span className="intel-chip">{finished.length} available</span>
          </div>
          <div className="mt-4">
            <FixtureRows
              matches={matchViews.filter(match => match.effectiveStatus === 'FINISHED').reverse().slice(0, 8)}
              emptyMessage="No finished fixtures are available for this team."
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Upcoming fixtures</h2>
            <span className="intel-chip">{upcoming.length} scheduled</span>
          </div>
          <div className="mt-4">
            <FixtureRows
              matches={matchViews.filter(match => match.effectiveStatus === 'SCHEDULED' || match.effectiveStatus === 'LIVE').slice(0, 8)}
              emptyMessage="No upcoming fixtures are currently available."
            />
          </div>
        </section>

        <section className="mt-8 intel-grid">
          <div className="intel-panel p-5">
            <h2 className="font-display text-lg font-bold">Competition position</h2>
            {positionRows.length === 0 ? (
              <div className="intel-empty mt-4">
                <CircleAlert className="h-5 w-5" aria-hidden />
                <p>Standings are unavailable for this team&apos;s competitions.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {positionRows.map(item => (
                  <Link key={item.competition.id} href={`/leagues/${item.competition.id}`} className="intel-panel-quiet flex min-w-0 items-center justify-between gap-3 p-4 transition-colors hover:border-accent-line">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-snug">{item.competition.name}</p>
                      <p className="mt-1 text-[11px] text-muted-text">Played {item.row.played} · GD {item.row.goalDifference > 0 ? '+' : ''}{item.row.goalDifference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl font-bold text-accent">{item.row.position}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-text">{item.row.points} pts</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="intel-panel p-5">
            <h2 className="font-display text-lg font-bold">Squad & coach</h2>
            <div className="intel-empty mt-4">
              <Users className="h-5 w-5" aria-hidden />
              <p>Player and manager details are not supplied by the current data provider.</p>
              <p>No ratings, injuries or tactical claims are inferred.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="intel-chip"><CalendarClock className="h-3 w-3" aria-hidden />{homeMatches.length} home analysed</span>
              <span className="intel-chip"><ArrowUpRight className="h-3 w-3" aria-hidden />{awayMatches.length} away analysed</span>
            </div>
          </div>
        </section>

        <div className="mt-8">
          <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
