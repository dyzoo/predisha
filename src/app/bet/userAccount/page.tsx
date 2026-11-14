import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Plane, Sparkles } from 'lucide-react'
import { AuthRequired } from '@/components/bet/auth-required'
import { SectionHeading } from '@/components/bet/section-heading'
import { TrialWithdrawalPanel } from '@/components/bet/trial-withdrawal-panel'
import { WalletCard } from '@/components/bet/wallet-card'
import { getViewer } from '@/lib/auth/session'
import { claimTrialForUser, getLatestTrialForUser } from '@/lib/bet/aviator-trial'
import { getWalletView } from '@/lib/bet/wallet'

export const metadata: Metadata = {
  title: 'Aviator prize account',
  description: 'Withdraw your Aviator trial prize and continue playing with real funds.',
}

export default async function UserAccountPage() {
  await connection()
  const viewer = await getViewer()

  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to claim your prize"
        description="Create a quick account to move your Aviator trial prize into your betting wallet."
        nextPath="/bet/userAccount"
      />
    )
  }

  try {
    await claimTrialForUser(viewer.userId)
  } catch (error) {
    console.error('[aviator-trial] claim on prize account failed', error)
  }

  const [trial, wallet] = await Promise.all([
    getLatestTrialForUser(viewer.userId),
    getWalletView(viewer.userId),
  ])

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Prize account"
        title="Your Aviator prize"
        description="Send the trial prize to mobile money, then continue with real Aviator bets."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {trial ? (
          <TrialWithdrawalPanel trial={trial} />
        ) : (
          <section className="rounded-3xl border border-border bg-surface/80 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Plane className="h-6 w-6 -rotate-12" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold">No trial prize yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-text">
              Pay a shared bet slip to unlock the free Aviator trial. The one-flight prize will appear
              here after you play.
            </p>
            <Link
              href="/bet/sports"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"
            >
              <Sparkles className="h-4 w-4" />
              Browse shared slips
            </Link>
          </section>
        )}

        <WalletCard wallet={wallet} />
      </div>
    </div>
  )
}

export const instant = false
