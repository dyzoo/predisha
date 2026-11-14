import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Plane } from 'lucide-react'
import { AviatorTrialGame } from '@/components/bet/aviator-trial-game'
import { getViewer } from '@/lib/auth/session'
import { getTrialViewFromCookie } from '@/lib/bet/aviator-trial'

export const metadata: Metadata = {
  title: 'Aviator trial',
  description: 'Play your free Aviator trial from a paid shared bet slip.',
}

export default async function AviatorTrialPage() {
  await connection()
  const [trial, viewer] = await Promise.all([getTrialViewFromCookie(), getViewer()])

  if (!trial) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Plane className="h-6 w-6 -rotate-12" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Aviator trial unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          Pay a shared bet slip to unlock the one-flight Aviator trial on this browser.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/bet/sports"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            Browse sportsbook
          </Link>
          <Link
            href="/bet"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
          >
            Back to bet home
          </Link>
        </div>
      </div>
    )
  }

  return <AviatorTrialGame initialTrial={trial} signedIn={Boolean(viewer.userId)} />
}

export const instant = false
