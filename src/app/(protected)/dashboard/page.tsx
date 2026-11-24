import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  CreditCard,
  History,
  Lock,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserRound,
} from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { DataFreshness } from '@/components/intelligence/data-freshness'
import { FixtureRows } from '@/components/intelligence/fixture-rows'
import { StandingsTable, type StandingsRow } from '@/components/intelligence/standings-table'
import { getMatchAnalyses } from '@/lib/sports/service'
import { getCompetitionStandings } from '@/lib/sports/standings-service'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { toMatchView } from '@/lib/sports/view-model'
import { prisma } from '@/lib/prisma'
import { formatTzs } from '@/lib/bet/format'
import { formatPlanAmount } from '@/lib/billing/plans'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Account" title="Your dashboard">
        <div className="intel-empty">
          <Lock className="h-6 w-6" aria-hidden />
          <p className="font-semibold text-main-text">Sign-in is not configured yet</p>
          <p>
            The dashboard and saved matches need a configured database and <code>AUTH_SECRET</code>.
            This build does not fake a session.
          </p>
          <Link href="/sign-in" className="intel-link inline-flex items-center gap-2 text-xs font-semibold">
            View account page
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/dashboard')

  const account = await prisma.user
    .findUnique({
      where: { id: viewer.userId },
      select: {
        name: true,
        email: true,
        role: true,
        createdAt: true,
        preferences: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            plan: { select: { name: true, interval: true, currency: true, amountMinor: true } },
          },
        },
        _count: { select: { savedFixtures: true } },
      },
    })
    .catch(() => null)

  if (!account) {
    return (
      <PageShell eyebrow="Account" title="Your dashboard">
        <div className="intel-empty">
          <CircleAlert className="h-5 w-5 text-amber-300" aria-hidden />
          <p>Your account could not be loaded right now. This is usually a temporary database issue.</p>
        </div>
      </PageShell>
    )
  }

  const [wonBets, winnerSlips] = await Promise.all([
    prisma.betTicket.findMany({
      where: { userId: viewer.userId, status: 'WON' },
      orderBy: [{ settledAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.betWinnerSlip.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const winNotifications = [
    ...wonBets.map(ticket => ({
      id: 'bet:' + ticket.id,
      message: 'You won on ticket ' + ticket.code + '. Payout after VAT: ' + formatTzs(ticket.payoutMinor) + ' TZS.',
      payoutMinor: ticket.payoutMinor,
    })),
    ...winnerSlips.map(slip => ({
      id: 'winner:' + slip.id,
      message: 'You won on ticket ' + slip.code + '. Payout after VAT: ' + formatTzs(slip.netPayoutMinor) + ' TZS.',
      payoutMinor: slip.netPayoutMinor,
    })),
  ].filter(notification => notification.payoutMinor > 0)

  const { analyses, dataset } = await getMatchAnalyses()
  const fixtures = analyses.map(analysis => toMatchView(analysis))
  const liveFixtures = fixtures.filter(match => match.effectiveStatus === 'LIVE')
  const upcomingFixtures = fixtures
    .filter(match => match.effectiveStatus === 'SCHEDULED')
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime())
  const topPicks = fixtures
    .filter(match => match.probability !== null)
    .sort((a, b) => (b.probability?.home ?? 0) + (b.probability?.away ?? 0) - ((a.probability?.home ?? 0) + (a.probability?.away ?? 0)))
    .slice(0, 3)

  const primaryCompetition = dataset.competitions.find(
    competition => competition.id === (upcomingFixtures[0]?.competitionId ?? liveFixtures[0]?.competitionId),
  )
  const standings = primaryCompetition
    ? await getCompetitionStandings(primaryCompetition.id, primaryCompetition.providerId)
    : null
  const providerTeamIds = new Map(
    dataset.teams
      .filter(team => team.providerId)
      .map(team => [team.providerId as string, team.id]),
  )
  const standingsRows: StandingsRow[] = (standings?.rows ?? []).slice(0, 8).map(row => {
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

  const premium = viewer.entitlement === 'PREMIUM' || viewer.entitlement === 'ADMIN'
  const subscription = account.subscription
  const price = subscription
    ? formatPlanAmount(subscription.plan.amountMinor, subscription.plan.currency)
    : null

  const managementLinks = [
    { href: '/settings/profile', label: 'Profile', description: 'Display name and account details', icon: UserRound },
    { href: '/settings/preferences', label: 'Preferences', description: 'Timezone, locale and follow lists', icon: SlidersHorizontal },
    { href: '/settings/billing', label: 'Billing', description: 'Plan, status and payment controls', icon: CreditCard },
    { href: '/saved', label: 'Saved matches', description: 'Bookmarked fixtures', icon: Bookmark },
    { href: '/history', label: 'Prediction history', description: 'Every slip you have built', icon: History },
  ]

  return (
    <PageShell
      eyebrow="Account"
      title={`Welcome${account.name ? `, ${account.name.split(' ')[0]}` : ''}`}
      intro="Your football intelligence hub: live fixtures, competition context and transparent model estimates."
    >
      {winNotifications.length > 0 ? (
        <section className="intel-panel intel-chip-accent p-5" role="status">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Winnings received
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed">{winNotifications[0].message}</p>
        </section>
      ) : null}

      <section className="intel-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="intel-eyebrow">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Football intelligence
            </p>
            <h2 className="mt-2 font-display text-xl font-bold">Start with the strongest model views</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-text">
              These are model probabilities with model-implied fair prices, not bookmaker odds. Open
              a fixture for the evidence, sample sizes and data-quality flags.
            </p>
          </div>
          <DataFreshness health={dataset.health} isDemo={dataset.isDemo} />
        </div>

        <div className="mt-5">
          <FixtureRows matches={topPicks} showCompetition limit={3} emptyMessage="No reliable model views are available yet." />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/matches" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            All fixtures
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
          <Link href="/leagues" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            Competitions
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
          <Link href="/teams" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            Teams
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </section>

      {standings && standingsRows.length > 0 ? (
        <section className="intel-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="intel-eyebrow">Table snapshot</p>
              <h2 className="mt-2 font-display text-lg font-bold">{primaryCompetition?.name ?? 'Competition'}</h2>
            </div>
            <Link href={`/leagues/${primaryCompetition?.id}`} className="intel-link inline-flex items-center gap-1.5 text-xs font-semibold">
              Full table
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="mt-4">
            <StandingsTable rows={standingsRows} />
          </div>
        </section>
      ) : null}

      <section className="intel-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="intel-eyebrow">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Match centre
            </p>
            <h2 className="mt-2 font-display text-lg font-bold">Live & upcoming</h2>
          </div>
          <Link href="/matches" className="intel-link inline-flex items-center gap-1.5 text-xs font-semibold">
            Explore all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {liveFixtures.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">Live now</h3>
            <div className="mt-3">
              <FixtureRows matches={liveFixtures} limit={4} emptyMessage="No live matches in the current dataset." />
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">Next fixtures</h3>
          <div className="mt-3">
            <FixtureRows matches={upcomingFixtures} limit={5} emptyMessage="No upcoming fixtures in the current dataset." />
          </div>
        </div>
      </section>

      <section className="intel-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="intel-eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Prediction builder
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-text">
              Rank upcoming fixtures into a transparent prediction slip you can download or share.
              No money moves through Predisha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/builder" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5">
              Build my prediction
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/history" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
              <History className="h-3 w-3" aria-hidden />
              Prediction history
            </Link>
          </div>
        </div>
      </section>

      <div className="intel-grid">
        <section className="intel-panel p-5">
          <p className="intel-eyebrow">Access</p>
          <p className="mt-3 text-lg font-semibold">
            {viewer.entitlement === 'ADMIN' ? 'Administrator' : premium ? 'Premium' : 'Free account'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-text">
            {premium
              ? 'Premium analysis is available for your account.'
              : 'Free accounts can preview a limited number of premium analyses.'}
          </p>
          <span className="intel-chip mt-3">{account.email}</span>
        </section>

        <section className="intel-panel p-5">
          <p className="intel-eyebrow">
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            Saved matches
          </p>
          <p className="mt-3 font-display text-3xl font-bold tabular-nums">{account._count.savedFixtures}</p>
          <Link href="/saved" className="intel-link mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
            Open saved matches
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>

        <section className="intel-panel p-5">
          <p className="intel-eyebrow">
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Subscription
          </p>
          {subscription ? (
            <div className="mt-3 space-y-2 text-xs">
              <p className="font-semibold">{subscription.plan.name} · {subscription.plan.interval.toLowerCase()} · {price}</p>
              <p>Status: <span className="font-semibold">{subscription.status}</span>{subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}</p>
              {subscription.currentPeriodEnd ? <p className="text-muted-text">Ends {subscription.currentPeriodEnd.toISOString().slice(0, 10)}.</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-text">
              No active subscription. Live billing stays off until a payment provider is approved.
            </p>
          )}
          <Link href="/settings/billing" className="intel-link mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
            Manage billing
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>

        <section className="intel-panel p-5">
          <p className="intel-eyebrow">Preferences</p>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div className="intel-panel-quiet p-3">
              <dt className="text-muted-text">Timezone</dt>
              <dd className="mt-1 font-semibold">{account.preferences?.timezone ?? 'UTC'}</dd>
            </div>
            <div className="intel-panel-quiet p-3">
              <dt className="text-muted-text">Locale</dt>
              <dd className="mt-1 font-semibold">{account.preferences?.locale ?? 'en'}</dd>
            </div>
          </dl>
          <Link href="/settings/preferences" className="intel-link mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
            Edit preferences
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>
      </div>

      <section className="intel-panel p-5">
        <h2 className="font-display text-base font-bold">Manage your account</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {managementLinks.map(item => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-accent-line hover:bg-background/70">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-[11px] leading-relaxed text-muted-text">{item.description}</span>
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-text transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
              </Link>
            )
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SignOutButton />
        {viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN' ? (
          <Link href="/admin" className="intel-chip intel-link hover:border-accent-line hover:text-accent">
            Admin console
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
      </div>
    </PageShell>
  )
}

export const instant = false
