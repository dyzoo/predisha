import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { WalletAmountForm } from '@/components/bet/wallet-amount-form'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { getWalletView } from '@/lib/bet/wallet'
import { betModeCopy, getBetMode, type BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Add funds',
  description: 'Deposit funds into your betting wallet with mobile money.',
}

export default async function BetDepositPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title={copy.depositTitle}
        description={copy.depositDescription}
        nextPath="/bet/deposit"
      />
    )
  }

  const wallet = await getWalletView(viewer.userId)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Wallet"
        title={copy.depositTitle}
        description={copy.depositDescription}
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <WalletAmountForm mode="deposit" wallet={wallet} />
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/80 p-5 text-sm leading-relaxed text-muted-text">
            <h2 className="font-display text-lg font-semibold text-main-text">What this does</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Credits the betting wallet after a confirmed mobile-money payment.</li>
              <li>Records a ledger entry so the balance can be audited.</li>
              <li>Uses an idempotency reference so retries do not double-credit.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm leading-relaxed text-muted-text">
            <h2 className="font-display text-lg font-semibold text-main-text">What this never does</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Asks for a mobile-money PIN or one-time payment approval.</li>
              <li>Contacts an external payment or withdrawal service.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export const instant = false