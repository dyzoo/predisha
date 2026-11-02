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
  Sparkles,
  UserRound,
} from 'lucide-react'
import { MatchCard } from '@/components/matches/match-card'
import { PageShell } from '@/components/page-shell'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { getMatchAnalyses } from '@/lib/sports/service'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { toMatchView } from '@/lib/sports/view-model'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Account" title="Your dashboard">
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold text-main-text">Sign-in is not configured yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            The dashboard and saved matches need a configured database and <code>AUTH_SECRET</code>.
            This build does not fake a session, so the area stays locked until those are set.
          </p>
          <Link
            href="/sign-in"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            View account page
            <ArrowRight className="h-4 w-4" />
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
        <div className="rounded-2xl border border-border bg-surface/50 p-6">
          <p className="flex items-start gap-2 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Your account could not be loaded right now. This is usually a temporary database issue.
          </p>
        </div>
      </PageShell>
    )
  }

  const { analyses, dataset } = await getMatchAnalyses()
  const fixtures = analyses.map(analysis => toMatchView(analysis))
  const liveFixtures = fixtures.filter(match => match.effectiveStatus === 'LIVE')
  const upcomingFixtures = fixtures
    .filter(match => match.effectiveStatus === 'SCHEDULED')
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime())

  const premium = viewer.entitlement === 'PREMIUM' || viewer.entitlement === 'ADMIN'
  const subscription = account.subscription
  const price = subscription
    ? new Intl.NumberFormat('en', {
        style: 'currency',
        currency: subscription.plan.currency,
      }).format(subscription.plan.amountMinor / 100)
    : null

  return (
    <PageShell
      eyebrow="Account"
      title={`Welcome${account.name ? `, ${account.name.split(' ')[0]}` : ''}`}
      intro="Manage your saved matches, preferences and plan. Billing stays disabled until a payment provider is approved."
    >
      <section className="rounded-2xl border border-accent/25 bg-accent/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              AI Bet Builder
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-text">
              Choose a risk preference and the model will rank upcoming fixtures into a transparent
              prediction slip you can download or share. No money moves through Predisha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              Build my prediction
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
            >
              <History className="h-4 w-4" />
              Prediction history
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/60 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Access
          </p>
          <p className="mt-3 text-lg font-semibold text-main-text">
            {viewer.entitlement === 'ADMIN'
              ? 'Administrator'
              : premium
                ? 'Premium'
                : 'Free account'}
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            {premium
              ? 'Premium analysis is available for your account.'
              : 'Free accounts can preview a limited number of premium analyses.'}
          </p>
          <span className="mt-3 inline-flex rounded-full border border-border bg-background/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
            {account.email}
          </span>
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
            <Bookmark className="h-3.5 w-3.5 text-accent" />
            Saved matches
          </p>
          <p className="mt-3 font-display text-3xl font-bold tabular-nums text-main-text">
            {account._count.savedFixtures}
          </p>
          <Link
            href="/saved"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            Open saved matches
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Settings className="h-4 w-4 text-accent" />
          Manage your account
        </h2>
        <p className="mt-1 text-xs leading-relaxed">
          Jump straight to the parts of your account you use most.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: '/settings/profile',
              label: 'Profile',
              description: 'Display name and account details',
              icon: UserRound,
            },
            {
              href: '/settings/preferences',
              label: 'Preferences',
              description: 'Timezone, locale and follow lists',
              icon: SlidersHorizontal,
            },
            {
              href: '/settings/billing',
              label: 'Billing',
              description: 'Plan, status and payment controls',
              icon: CreditCard,
            },
            {
              href: '/saved',
              label: 'Saved matches',
              description: 'Bookmarked fixtures',
              icon: Bookmark,
            },
            {
              href: '/history',
              label: 'Prediction history',
              description: 'Every slip you have built',
              icon: History,
            },
          ].map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-accent/40 hover:bg-background/70"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-main-text">{item.label}</span>
                  <span className="block text-[11px] leading-relaxed text-muted-text">
                    {item.description}
                  </span>
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-text transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Radio className="h-4 w-4 text-accent" />
          Match centre
        </h2>
        <p className="mt-1 text-xs leading-relaxed">
          Live and upcoming fixtures from the current dataset. Live scores and probabilities are
          refreshed with each sync.
        </p>

        {liveFixtures.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
              Live now
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {liveFixtures.map(match => (
                <MatchCard key={match.id} match={match} isDemo={dataset.isDemo} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs">
            No live matches in the current dataset.
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-text">
            Upcoming fixtures
          </h3>
          {upcomingFixtures.length > 0 ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {upcomingFixtures.slice(0, 3).map(match => (
                <MatchCard key={match.id} match={match} isDemo={dataset.isDemo} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs">
              No upcoming fixtures in the current dataset.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Subscription
        </h2>
        {subscription ? (
          <div className="mt-3 space-y-2 text-xs">
            <p className="text-main-text">
              {subscription.plan.name} · {subscription.plan.interval.toLowerCase()} · {price}
            </p>
            <p>
              Status: <span className="font-semibold text-main-text">{subscription.status}</span>
              {subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}
            </p>
            {subscription.currentPeriodEnd ? (
              <p>Current period ends {subscription.currentPeriodEnd.toISOString().slice(0, 10)}.</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed">
            No active subscription. Paid plans cannot be purchased on this deployment yet; live
            billing stays off until a payment provider is approved.
          </p>
        )}
        <Link
          href="/settings/billing"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          Manage billing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Settings className="h-4 w-4 text-accent" />
          Preferences
        </h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Timezone</dt>
            <dd className="mt-1 font-semibold text-main-text">
              {account.preferences?.timezone ?? 'UTC'}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Locale</dt>
            <dd className="mt-1 font-semibold text-main-text">
              {account.preferences?.locale ?? 'en'}
            </dd>
          </div>
        </dl>
        <Link
          href="/settings/preferences"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          Edit preferences
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SignOutButton />
        {viewer.role === 'ADMIN' ? (
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            Admin console
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </PageShell>
  )
}

export const instant = false
