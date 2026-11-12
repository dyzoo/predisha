import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { SandboxAmountForm } from '@/components/bet/sandbox-amount-form'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { getWalletView } from '@/lib/bet/wallet'

export const metadata: Metadata = {
  title: 'Sandbox withdrawal',
  description: 'Move play money out of your sandbox wallet. No real payout is made.',
}

export default async function BetWithdrawPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to withdraw sandbox funds"
        description="Sandbox withdrawals only change your play-money balance. They are not real payouts."
        nextPath="/bet/withdraw"
      />
    )
  }

  const wallet = await getWalletView(viewer.userId)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Wallet"
        title="Sandbox withdrawal"
        description="This removes play money from your sandbox balance. No external payment is triggered."
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <SandboxAmountForm mode="withdraw" wallet={wallet} />
        <div className="rounded-2xl border border-border bg-surface/80 p-5 text-sm leading-relaxed text-muted-text">
          <h2 className="font-display text-lg font-semibold text-main-text">Sandbox only</h2>
          <p className="mt-2">
            Unlike the original paribet flow, this form does not collect a phone number or PIN and
            does not call a withdrawal backend. The request is a local ledger entry protected by
            your authenticated session, same-origin checks and rate limiting.
          </p>
          <p className="mt-3">
            If the balance is insufficient, the API rejects the request without changing your
            wallet.
          </p>
        </div>
      </div>
    </div>
  )
}

export const instant = false
