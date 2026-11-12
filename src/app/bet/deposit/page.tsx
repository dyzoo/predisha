import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { SandboxAmountForm } from '@/components/bet/sandbox-amount-form'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { getWalletView } from '@/lib/bet/wallet'

export const metadata: Metadata = {
  title: 'Add sandbox funds',
  description: 'Credit your play-money wallet. No payment method or PIN is requested.',
}

export default async function BetDepositPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to add sandbox funds"
        description="Sandbox credit is stored against your account so it cannot be spent anonymously."
        nextPath="/bet/deposit"
      />
    )
  }

  const wallet = await getWalletView(viewer.userId)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Wallet"
        title="Add sandbox funds"
        description="This is a demo top-up. It does not charge a card, phone number or mobile-money account."
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <SandboxAmountForm mode="deposit" wallet={wallet} />
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/80 p-5 text-sm leading-relaxed text-muted-text">
            <h2 className="font-display text-lg font-semibold text-main-text">What this does</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Credits play money to your PredishaBet wallet instantly.</li>
              <li>Records a ledger entry so your balance can be audited.</li>
              <li>Uses an idempotency reference so retries do not double-credit.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm leading-relaxed text-muted-text">
            <h2 className="font-display text-lg font-semibold text-main-text">What this never does</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Ask for a mobile-money PIN or one-time payment approval.</li>
              <li>Contact an external payment or withdrawal service.</li>
              <li>Create a real-money balance or cash value.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export const instant = false
