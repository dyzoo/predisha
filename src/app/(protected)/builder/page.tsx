import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowRight, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { BetBuilder } from '@/components/builder/bet-builder'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { canViewPremium } from '@/lib/auth/entitlements'
import { getFreePreviewState } from '@/lib/auth/free-preview'
import { defaultCurrency } from '@/lib/predictions/builder-types'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { getMatchAnalyses } from '@/lib/sports/service'

export const metadata: Metadata = {
  title: 'AI Bet Builder',
  description:
    'Rank model picks and generate a transparent prediction slip to download or share.',
}

export default async function BuilderPage() {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-main-text">
        <SiteHeader />
        <main className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Lock className="h-5 w-5" />
              </span>
              <p className="mt-4 text-base font-semibold">Sign-in is not configured yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-text">
                The bet builder needs an account backed by a database and <code>AUTH_SECRET</code>.
                Set those environment variables to enable the guided flow.
              </p>
              <Link
                href="/matches"
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-elevated-surface"
              >
                Browse matches
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/builder')

  const { analyses, dataset } = await getMatchAnalyses()
  const eligibleCount = analyses.filter(
    analysis =>
      analysis.fixture.status === 'SCHEDULED' && analysis.prediction !== null,
  ).length
  const premium = canViewPremium(viewer)
  const currency = defaultCurrency()
  const freePreview =
    viewer.userId && !premium && !dataset.isDemo
      ? await getFreePreviewState(viewer.userId)
      : null

  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            AI Bet Builder
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Build your prediction
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-text sm:text-base">
            Choose a risk preference and the model ranks the upcoming fixtures that pass its quality
            gates. You get a transparent slip with every selection and its model probability, ready
            to download or share.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-text">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              No bets are placed and no funds are held
            </span>
            <span className="inline-flex items-center gap-1.5">
              {dataset.health.mode === 'demo'
                ? 'Demo dataset active'
                : dataset.health.ok
                  ? 'Stored dataset available'
                  : 'Data provider unavailable'}
            </span>
          </div>

          {dataset.isDemo ? (
            <div className="mt-6 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
              Demo mode is active. Fixtures and probabilities are illustrative and not real
              forecasts.
            </div>
          ) : null}

          <div className="mt-10">
            <BetBuilder
              premium={premium}
              currency={currency}
              demo={dataset.isDemo}
              eligibleCount={eligibleCount}
              freePreviewUsed={freePreview?.used ?? false}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false
