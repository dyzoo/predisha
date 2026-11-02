import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowRight, Bookmark, CircleAlert, Lock } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { MatchCard } from '@/components/matches/match-card'
import { SaveMatchButton } from '@/components/matches/save-match-button'
import { isAuthConfigured, getViewer } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

export const metadata: Metadata = {
  title: 'Saved matches',
}

export default async function SavedPage() {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Account" title="Saved matches">
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold text-main-text">Sign-in is not configured yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            Saving matches requires an account backed by a database. This build keeps the area
            locked rather than pretending to store data.
          </p>
          <Link
            href="/matches"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            Browse matches
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/saved')

  const saved = await prisma.savedFixture
    .findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { fixtureId: true },
    })
    .catch(() => null)

  if (!saved) {
    return (
      <PageShell eyebrow="Account" title="Saved matches">
        <div className="rounded-2xl border border-border bg-surface/50 p-6">
          <p className="flex items-start gap-2 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Saved matches could not be loaded right now. Please try again shortly.
          </p>
        </div>
      </PageShell>
    )
  }

  const { analyses, dataset } = await getMatchAnalyses()
  const savedIds = new Set(saved.map(item => item.fixtureId))
  const matches = analyses.filter(analysis => savedIds.has(analysis.fixture.id))

  return (
    <PageShell
      eyebrow="Account"
      title="Saved matches"
      intro="Matches you bookmarked. Removing one here only affects your account."
    >
      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Bookmark className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold text-main-text">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            Open any match analysis and choose “Save match” to keep it here.
          </p>
          <Link
            href="/matches"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            Browse matches
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matches.map(analysis => (
            <div key={analysis.fixture.id} className="space-y-2">
              <MatchCard match={toMatchView(analysis)} isDemo={dataset.isDemo} />
              <div className="flex justify-end">
                <SaveMatchButton
                  fixtureId={analysis.fixture.id}
                  initialSaved
                  signedIn
                  authConfigured
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {savedIds.size > matches.length ? (
        <p className="text-[11px] leading-relaxed">
          {savedIds.size - matches.length} saved fixture(s) are not in the current provider window
          and are hidden rather than shown with stale or invented data.
        </p>
      ) : null}
    </PageShell>
  )
}

export const instant = false
