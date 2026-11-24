import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleAlert,
  Clock3,
  Info,
  ShieldCheck,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { BetSlip } from '@/components/matches/bet-slip'
import { MatchAutoRefresh } from '@/components/matches/match-explorer'
import { MatchStatsTabs } from '@/components/matches/match-stats-tabs'
import { SaveMatchButton } from '@/components/matches/save-match-button'
import { TeamBadge } from '@/components/teams/team-badge'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { MatchAnalysisPanel } from '@/components/intelligence/match-analysis-panel'
import { MatchCentre } from '@/components/intelligence/match-centre'
import { TeamFormStrip } from '@/components/intelligence/team-form-strip'
import { EmptyState } from '@/components/intelligence/ui-states'
import { canViewPremium } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getMatchAnalysis } from '@/lib/sports/service'
import { getCompetitionStandings } from '@/lib/sports/standings-service'
import {
  buildMatchStatsView,
  formatDateTime,
  formatMatchTime,
  outcomeLabel,
  toMatchView,
} from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Match intelligence',
  description: 'Transparent probabilities, fair model prices, form and the data behind a football prediction.',
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const { analysis, dataset } = await getMatchAnalysis(matchId)

  if (!analysis) notFound()

  const view = toMatchView(analysis)
  const stats = buildMatchStatsView(analysis, dataset.fixtures, dataset.teams)
  const { fixture, prediction, features, home, away, competition, sport } = analysis
  const isFinished = view.effectiveStatus === 'FINISHED'
  const statusLabel =
    view.effectiveStatus === 'LIVE'
      ? `LIVE${typeof view.minute === 'number' ? ` ${view.minute}'` : ''}`
      : view.effectiveStatus === 'FINISHED'
        ? 'Full time'
        : view.effectiveStatus === 'SCHEDULED'
          ? 'Upcoming'
          : view.effectiveStatus

  const standings = await getCompetitionStandings(competition.id, competition.providerId)
  const standingFor = (team: typeof home) =>
    standings.rows.find(row => {
      const byProviderId = team.providerId ? row.teamId === team.providerId : false
      return byProviderId || row.teamName.toLowerCase() === team.name.toLowerCase()
    }) ?? null
  const homeStanding = standingFor(home)
  const awayStanding = standingFor(away)

  const viewer = await getViewer()
  const premiumView = canViewPremium(viewer) || dataset.isDemo
  const initialSaved = viewer.userId
    ? await prisma.savedFixture
        .findUnique({
          where: { userId_fixtureId: { userId: viewer.userId, fixtureId: fixture.id } },
          select: { id: true },
        })
        .then(item => Boolean(item))
        .catch(() => false)
    : false

  const score =
    typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'
      ? `${fixture.homeScore} : ${fixture.awayScore}`
      : 'vs'

  const overview = (
    <div className="intel-grid">
      <section className="intel-panel p-5 sm:p-6">
        <p className="intel-eyebrow">Match snapshot</p>
        <h2 className="mt-2 font-display text-xl font-bold">
          {view.probability ? 'What the model currently estimates' : 'No reliable model selection'}
        </h2>

        {view.probability ? (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: 'Home', value: view.probability.home, tone: 'text-accent' },
                { label: 'Draw', value: view.probability.draw, tone: 'text-main-text' },
                { label: 'Away', value: view.probability.away, tone: 'text-[#8FB4FF]' },
              ].map(item => (
                <div key={item.label} className="intel-panel-quiet p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-text">{item.label}</p>
                  <p className={`mt-1 font-display text-xl font-bold tabular-nums ${item.tone}`}>{percent(item.value)}</p>
                  <p className="mt-1 text-[10px] text-muted-text">Fair {Number.isFinite(1 / item.value) ? (1 / item.value).toFixed(2) : '—'}</p>
                </div>
              ))}
            </div>
            <div className="intel-progress mt-4" role="img" aria-label={`Home ${percent(view.probability.home)}, draw ${percent(view.probability.draw)}, away ${percent(view.probability.away)}`}>
              <span style={{ width: percent(view.probability.home) }} />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-text">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Fair prices shown here are model-generated from probabilities. They are not bookmaker
              odds, guarantees or betting advice.
            </p>
          </>
        ) : (
          <div className="intel-empty mt-5">
            <CircleAlert className="h-6 w-6" aria-hidden />
            <p>The model withheld a selection because the recent sample is missing, stale or too small.</p>
          </div>
        )}

        {prediction ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="intel-chip intel-chip-accent"><ShieldCheck className="h-3 w-3" aria-hidden />{prediction.modelVersion}</span>
            <span className="intel-chip"><Clock3 className="h-3 w-3" aria-hidden />Input {formatDateTime(prediction.inputDataAsOf)}</span>
            <span className="intel-chip">xG {prediction.homeExpectedGoals.toFixed(2)} / {prediction.awayExpectedGoals.toFixed(2)}</span>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4">
        {!isFinished ? (
          <BetSlip match={view} premium={premiumView} />
        ) : (
          <section className="intel-panel p-5">
            <h2 className="font-display text-base font-bold">Pre-match snapshot</h2>
            <p className="mt-1 text-xs text-muted-text">Preserved as generated before kickoff.</p>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-text">Model</dt><dd className="font-semibold">{prediction?.modelVersion ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-text">1X2</dt><dd className="font-semibold tabular-nums">{view.probability ? `${percent(view.probability.home)} / ${percent(view.probability.draw)} / ${percent(view.probability.away)}` : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-text">Expected goals</dt><dd className="font-semibold tabular-nums">{prediction ? `${prediction.homeExpectedGoals.toFixed(2)} / ${prediction.awayExpectedGoals.toFixed(2)}` : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-text">Data as of</dt><dd className="font-semibold">{prediction ? formatDateTime(prediction.inputDataAsOf) : '—'}</dd></div>
            </dl>
          </section>
        )}
        <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
      </div>
    </div>
  )

  const analysisPanel = (
    <MatchAnalysisPanel
      probability={view.probability}
      expectedGoals={prediction ? { home: prediction.homeExpectedGoals, away: prediction.awayExpectedGoals } : null}
      marketOptions={view.marketOptions}
      modelVersion={prediction?.modelVersion ?? null}
      dataAsOfLabel={prediction ? formatDateTime(prediction.inputDataAsOf) : null}
      qualityFlags={prediction?.qualityFlags ?? []}
      explanation={analysis.explanation}
      facts={prediction?.structuredFacts ?? null}
      isDemo={dataset.isDemo}
    />
  )

  const statistics = (
    <div className="grid gap-5">
      <MatchStatsTabs stats={stats} homeName={home.name} awayName={away.name} />
      {isFinished ? (
        <section className="intel-panel p-5">
          <h2 className="font-display text-lg font-bold">Verified match record</h2>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Home', home.name],
              ['Away', away.name],
              ['Competition', competition.name],
              ['Score', `${fixture.homeScore ?? '-'} - ${fixture.awayScore ?? '-'}`],
              ['Kickoff', formatDateTime(fixture.kickoffUtc)],
              ['Venue', fixture.venue ?? 'Not supplied'],
              ['Home sample', `${features.home.matches} matches`],
              ['Away sample', `${features.away.matches} matches`],
            ].map(([label, value]) => (
              <div key={label} className="intel-panel-quiet p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">{label}</dt>
                <dd className="mt-1 break-words font-semibold leading-snug">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  )

  const history = (
    <div className="intel-grid">
      {[
        { team: home, form: features.home.form, matches: features.home.matches, elo: features.home.elo },
        { team: away, form: features.away.form, matches: features.away.matches, elo: features.away.elo },
      ].map(item => (
        <section key={item.team.id} className="intel-panel p-5">
          <div className="flex min-w-0 items-center gap-3">
            <TeamBadge team={{ ...item.team, short: item.team.shortName }} size="sm" />
            <div className="min-w-0">
              <h2 className="break-words font-display text-base font-bold leading-snug">{item.team.name}</h2>
              <p className="mt-1 text-[11px] text-muted-text">{item.matches} eligible matches · Elo {Math.round(item.elo)}</p>
            </div>
          </div>
          <div className="mt-5">
            <TeamFormStrip form={item.form} label="Recent form" />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-text">
            Form uses only finished matches before the prediction input cutoff. Missing matches are
            excluded rather than treated as losses or draws.
          </p>
          <Link href={`/teams/${item.team.id}`} className="intel-link mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
            Open team profile
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>
      ))}
    </div>
  )

  const context = (
    <div className="intel-grid">
      <section className="intel-panel p-5 lg:col-span-2">
        <p className="intel-eyebrow">Standings context</p>
        <h2 className="mt-2 font-display text-xl font-bold">Where both teams sit</h2>
        {homeStanding || awayStanding ? (
          <div className="intel-grid mt-4">
            {[
              { team: home, row: homeStanding },
              { team: away, row: awayStanding },
            ].map(item => (
              <div key={item.team.id} className="intel-panel-quiet min-w-0 p-4">
                <p className="break-words text-xs font-semibold leading-snug">{item.team.name}</p>
                {item.row ? (
                  <p className="mt-2 font-display text-lg font-bold tabular-nums">
                    Position {item.row.position} · {item.row.points} pts
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-text">Position unavailable for this team</p>
                )}
                {item.row ? (
                  <p className="mt-1 text-[11px] text-muted-text">
                    Played {item.row.played} · GD {item.row.goalDifference > 0 ? '+' : ''}{item.row.goalDifference}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            title="Standings are unavailable for this competition"
            description={standings.message}
          />
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-text">
          League position is contextual evidence only. It is not used as a prediction factor.
        </p>
      </section>

      <section className="intel-panel p-5">
        <p className="intel-eyebrow">Competition context</p>
        <h2 className="mt-2 font-display text-xl font-bold">{competition.name}</h2>
        <p className="mt-2 text-xs text-muted-text">{competition.country ?? 'International'} · {competition.season ?? 'Current season'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/leagues/${competition.id}`} className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            <Trophy className="h-3 w-3" aria-hidden />
            Competition hub
          </Link>
          <Link href="/methodology" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            Methodology
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="intel-panel p-5">
        <p className="intel-eyebrow">Fixture details</p>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          {[
            ['Sport', sport.name],
            ['Status', statusLabel],
            ['Kickoff UTC', formatDateTime(fixture.kickoffUtc)],
            ['Local kickoff', formatMatchTime(fixture.kickoffUtc)],
            ['Venue', fixture.venue ?? 'Not supplied'],
            ['Referee', fixture.referee ?? 'Not supplied'],
            ['Odds source', prediction ? 'Model-implied fair prices' : 'Unavailable'],
            ['Pre-match preserved', prediction ? 'Yes' : 'No valid prediction'],
          ].map(([label, value]) => (
            <div key={label} className="intel-panel-quiet p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-text">{label}</dt>
              <dd className="mt-1 break-words font-semibold leading-snug">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="intel-panel p-5 lg:col-span-2">
        <p className="intel-eyebrow">Data lineage</p>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          {[
            ['Source', dataset.isDemo ? 'Demo dataset' : 'Connected football data provider'],
            ['Freshness', dataset.health.message],
            ['Historical matches', features.home.matches + features.away.matches],
            ['Quality flags', prediction?.qualityFlags.join(', ') || 'None'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
              <dt className="text-muted-text">{label}</dt>
              <dd className="text-right font-semibold leading-snug">{value}</dd>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="intel-shell intel-section flex-1">
        <MatchAutoRefresh />

        <Link href="/matches" className="intel-link inline-flex items-center gap-2 text-xs font-semibold">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to matches
        </Link>

        <header className="intel-panel mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
            <Link href={`/leagues/${competition.id}`} className="intel-link min-w-0 leading-snug">
              {sport.name} · {competition.name}
            </Link>
            <span className="intel-chip">
              {view.effectiveStatus === 'LIVE' ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              ) : (
                <CalendarClock className="h-3 w-3" aria-hidden />
              )}
              {statusLabel}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <TeamBadge team={view.home} size="xl" />
              <div className="min-w-0">
                <h1 className="break-words font-display text-lg font-bold leading-tight sm:text-2xl">{home.name}</h1>
                <p className="mt-1 text-xs text-muted-text">Home</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-center text-center">
              <span className="whitespace-nowrap font-display text-2xl font-bold tabular-nums sm:text-4xl">{score}</span>
              <span className="mt-2 max-w-[110px] text-[10px] leading-relaxed text-muted-text sm:max-w-[150px] sm:text-[11px]">
                {formatMatchTime(fixture.kickoffUtc)}
              </span>
            </div>

            <div className="flex min-w-0 flex-col items-end gap-3 text-right">
              <TeamBadge team={view.away} size="xl" />
              <div className="min-w-0">
                <h2 className="break-words font-display text-lg font-bold leading-tight sm:text-2xl">{away.name}</h2>
                <p className="mt-1 text-xs text-muted-text">Away</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-5 text-xs text-muted-text">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden />Kickoff UTC: {formatDateTime(fixture.kickoffUtc)}</span>
            {prediction ? <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />Input as of {formatDateTime(prediction.inputDataAsOf)}</span> : null}
            <div className="ml-auto">
              <SaveMatchButton
                fixtureId={fixture.id}
                initialSaved={initialSaved}
                signedIn={Boolean(viewer.userId)}
                authConfigured={isAuthConfigured()}
              />
            </div>
          </div>
        </header>

        {dataset.isDemo ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-xs leading-relaxed text-accent">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>Demo fixture and fictional teams. Probabilities illustrate the interface and model contract only; they are not real forecasts.</p>
          </div>
        ) : null}

        {view.evaluation ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface/50 px-4 py-3 text-xs text-muted-text">
            <span className="font-semibold text-main-text">Post-match evaluation</span>
            <span>Actual: {outcomeLabel(view.evaluation.actualOutcome)}</span>
            <span>Brier: {view.evaluation.brierScore.toFixed(4)}</span>
            <span>Log loss: {view.evaluation.logLoss.toFixed(4)}</span>
            <span className={view.evaluation.correct ? 'text-accent' : 'text-red-300'}>
              {view.evaluation.correct ? 'Top outcome correct' : 'Top outcome missed'}
            </span>
          </div>
        ) : null}

        <MatchCentre
          overview={overview}
          analysis={analysisPanel}
          statistics={statistics}
          history={history}
          context={context}
        />

        {isFinished && !view.evaluation ? (
          <p className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs leading-relaxed text-muted-text">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This match finished before a valid pre-match prediction could be generated, so no evaluation is shown.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
