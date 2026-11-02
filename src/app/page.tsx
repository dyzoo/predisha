import { Activity, ArrowRight, CalendarClock, Globe2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/landing/hero'
import { MatchShowcase } from '@/components/landing/match-showcase'
import { Features } from '@/components/landing/features'
import { PricingPreview } from '@/components/landing/pricing-preview'
import { CallToAction } from '@/components/landing/cta'
import { LiveTicker } from '@/components/landing/live-ticker'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { getViewer } from '@/lib/auth/session'

const trustItems = [
  { icon: Activity, label: 'Multi-market probabilities' },
  { icon: CalendarClock, label: 'Data timestamps' },
  { icon: Globe2, label: 'Timezone-aware kickoffs' },
  { icon: ShieldCheck, label: 'No bet placement' },
]

export default async function Home() {
  const { analyses, dataset } = await getMatchAnalyses()
  const viewer = await getViewer()
  const signedIn = Boolean(viewer.userId)
  const health = dataset.health
  const isDemo = dataset.isDemo
  const matches = analyses.map(analysis => toMatchView(analysis))
  const featured =
    matches.find(match => match.effectiveStatus === 'LIVE' && match.probability) ??
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
              <div className="rounded-3xl border border-border bg-surface/60 p-6 sm:p-10 text-center">
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Your account
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-text sm:text-base">
                  You are signed in. Build predictions, save matches, and review your history from
                  your dashboard.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/builder"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
                  >
                    Build a prediction
                    <ArrowRight className="h-4 w-4" />
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
