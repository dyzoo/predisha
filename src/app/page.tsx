import { Activity, ArrowRight, CalendarClock, Globe2, ShieldCheck, Trophy } from 'lucide-react'
import Link from 'next/link'
import { connection } from 'next/server'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/landing/hero'
import { MatchShowcase } from '@/components/landing/match-showcase'
import { Features } from '@/components/landing/features'
import { PricingPreview } from '@/components/landing/pricing-preview'
import { CallToAction } from '@/components/landing/cta'
import { LiveTicker } from '@/components/landing/live-ticker'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { FixtureRows } from '@/components/intelligence/fixture-rows'
import { StandingsTable, type StandingsRow } from '@/components/intelligence/standings-table'
import { getMatchAnalyses } from '@/lib/sports/service'
import { getCompetitionStandings } from '@/lib/sports/standings-service'
import { toMatchView } from '@/lib/sports/view-model'
import { getViewer } from '@/lib/auth/session'

const trustItems = [
  { icon: Activity, label: 'Multi-market probabilities' },
  { icon: CalendarClock, label: 'Data timestamps' },
  { icon: Globe2, label: 'Timezone-aware kickoffs' },
  { icon: ShieldCheck, label: 'No bet placement' },
]

export default async function Home() {
  await connection()
  const [{ analyses, dataset }, viewer] = await Promise.all([
    getMatchAnalyses(),
    getViewer(),
  ])
  const signedIn = Boolean(viewer.userId)
  const health = dataset.health
  const isDemo = dataset.isDemo
  const matches = analyses.map(analysis => toMatchView(analysis))
  const recentFinished =
    matches
      .filter(match => match.effectiveStatus === 'FINISHED')
      .sort(
        (a, b) =>
          new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime(),
      )
      .find(match => match.probability || match.score) ??
    matches.find(match => match.effectiveStatus === 'FINISHED')
  const upcoming = matches
    .filter(match => match.effectiveStatus === 'LIVE' || match.effectiveStatus === 'SCHEDULED')
    .sort((a, b) => {
      if (a.effectiveStatus === 'LIVE' && b.effectiveStatus !== 'LIVE') return -1
      if (b.effectiveStatus === 'LIVE' && a.effectiveStatus !== 'LIVE') return 1
      return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
    })
  const featured =
    matches.find(match => match.effectiveStatus === 'LIVE' && match.probability) ??
    recentFinished ??
    upcoming[0] ??
    matches.find(match => match.probability) ??
    matches[0]
  const liveMatches = matches.filter(match => match.effectiveStatus === 'LIVE')
  const showcaseMatches = matches
    .filter(match => match.effectiveStatus === 'LIVE' || match.effectiveStatus === 'SCHEDULED')
    .sort((a, b) => {
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1
      return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
    })
    .slice(0, 3)

  const competitionSummaries = dataset.competitions
    .map(competition => ({
      competition,
      fixtures: matches.filter(match => match.competitionId === competition.id).length,
    }))
    .sort((a, b) => b.fixtures - a.fixtures)
    .slice(0, 6)
  const primaryCompetition = competitionSummaries[0]?.competition
  const standings = primaryCompetition
    ? await getCompetitionStandings(primaryCompetition.id, primaryCompetition.providerId)
    : null
  const providerTeamIds = new Map(
    dataset.teams
      .filter(team => team.providerId)
      .map(team => [team.providerId as string, team.id]),
  )
  const standingsRows: StandingsRow[] = (standings?.rows ?? []).slice(0, 6).map(row => {
    const localTeamId =
      providerTeamIds.get(row.teamId) ??
      dataset.teams.find(team => team.name.toLowerCase() === row.teamName.toLowerCase())?.id ??
      null
    const team = localTeamId ? dataset.teams.find(item => item.id === localTeamId) : null
    return {
      ...row,
      localTeamId,
      color: team?.color ?? null,
      logoUrl: team?.logoUrl ?? row.logoUrl,
    }
  })

  return (
    <div className="min-h-screen bg-background text-main-text">
      <SiteHeader />
      <main>
        <Hero featured={featured} isDemo={isDemo} />

        <div className="border-y border-border bg-surface/30">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text sm:px-6 lg:px-8">
            {trustItems.map(item => (
              <span key={item.label} className="inline-flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 text-accent" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <LiveTicker liveMatches={liveMatches} />

        <section className="intel-shell intel-section">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="intel-eyebrow">Explore the board</p>
              <h2 className="intel-title mt-3">Fixtures, tables and teams in one place</h2>
              <p className="intel-subtitle mt-4">
                Start with the nearest fixtures or open a competition for standings and team context.
                Every estimate keeps its timestamp and data-quality flags.
              </p>
            </div>
            <DataFreshness health={health} isDemo={isDemo} />
          </div>

          <div className="intel-grid mt-8">
            <section className="intel-panel p-5">
              <h3 className="font-display text-lg font-bold">Next fixtures</h3>
              <p className="mt-1 text-xs text-muted-text">Live and scheduled matches from the current dataset.</p>
              <div className="mt-4">
                <FixtureRows matches={upcoming} limit={4} emptyMessage="No live or scheduled fixtures are connected." />
              </div>
              <Link href="/matches" className="intel-link mt-4 inline-flex items-center gap-1.5 text-xs font-semibold">
                Browse all fixtures
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </section>

            <section className="intel-panel p-5">
              <h3 className="font-display text-lg font-bold">Competitions</h3>
              <p className="mt-1 text-xs text-muted-text">Open a league for table, fixtures and team profiles.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {competitionSummaries.map(({ competition, fixtures }) => (
                  <Link key={competition.id} href={`/leagues/${competition.id}`} className="intel-chip intel-link hover:border-accent-line hover:text-accent">
                    <Trophy className="h-3 w-3" aria-hidden />
                    <span className="min-w-0 break-words leading-snug">{competition.name}</span>
                    <span className="tabular-nums text-muted-text">{fixtures}</span>
                  </Link>
                ))}
              </div>
              {competitionSummaries.length === 0 ? (
                <div className="intel-empty mt-4">No competitions are connected.</div>
              ) : null}
              <Link href="/leagues" className="intel-link mt-4 inline-flex items-center gap-1.5 text-xs font-semibold">
                All competitions
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </section>
          </div>

          {standingsRows.length > 0 && primaryCompetition ? (
            <section className="intel-panel mt-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="intel-eyebrow">Table snapshot</p>
                  <h3 className="mt-2 font-display text-lg font-bold">{primaryCompetition.name}</h3>
                </div>
                <Link href={`/leagues/${primaryCompetition.id}`} className="intel-link inline-flex items-center gap-1.5 text-xs font-semibold">
                  Full competition hub
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <div className="mt-4">
                <StandingsTable rows={standingsRows} />
              </div>
            </section>
          ) : null}
        </section>

        <MatchShowcase matches={showcaseMatches} isDemo={isDemo} />
        <Features health={health} />
        {!signedIn ? (
          <>
            <PricingPreview />
            <CallToAction />
          </>
        ) : (
          <section className="py-16 sm:py-20">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="intel-panel p-6 text-center sm:p-10">
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Your account
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-text sm:text-base">
                  You are signed in. Build predictions, review saved matches and track your history
                  from your dashboard.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/builder"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
                  >
                    Build a prediction
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-background/70"
                  >
                    Go to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
