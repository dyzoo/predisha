import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { Plane, Trophy, Wallet } from 'lucide-react'
import { TrialSignupForm } from '@/components/bet/trial-signup-form'
import { getViewer } from '@/lib/auth/session'
import { getTrialViewFromCookie } from '@/lib/bet/aviator-trial'
import { formatTzs } from '@/lib/bet/format'

export const metadata: Metadata = {
  title: 'Claim Aviator prize',
  description: 'Create a quick PredishaBet account to withdraw your Aviator trial prize.',
}

export default async function EasySignupPage() {
  await connection()
  const [viewer, trial] = await Promise.all([getViewer(), getTrialViewFromCookie()])

  if (viewer.userId) {
    redirect('/bet/userAccount')
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/20 via-surface to-surface p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-background">
          <Plane className="h-6 w-6 -rotate-12" />
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Aviator trial prize
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {trial ? formatTzs(trial.prizeMinor) : 'Your trial prize'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          Finish this short account setup and the prize moves into your betting wallet. Then request a
          mobile-money payout from your prize account.
        </p>
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-text">
            <Trophy className="h-4 w-4 text-accent" />
            One-play trial completed
          </div>
          <div className="flex items-center gap-2 text-muted-text">
            <Wallet className="h-4 w-4 text-accent" />
            Mobile-money payout in 6 hours
          </div>
        </div>
      </section>

      <TrialSignupForm />
    </div>
  )
}

export const instant = false
