import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { WalletAmountForm } from '@/components/bet/wallet-amount-form'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { getWalletView } from '@/lib/bet/wallet'
import { betModeCopy, getBetMode, type BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Withdraw funds',
  description: 'Withdraw funds from your betting wallet.',
}

export default async function BetWithdrawPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title={copy.withdrawTitle}
        description={copy.withdrawDescription}
        nextPath="/bet/withdraw"
      />
    )
  }

  const wallet = await getWalletView(viewer.userId)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Wallet"
        title={copy.withdrawTitle}
        description={copy.withdrawDescription}
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <WalletAmountForm mode="withdraw" wallet={wallet} />
        <div className="rounded-2xl border border-border bg-surface/80 p-5 text-sm leading-relaxed text-muted-text">
          <h2 className="font-display text-lg font-semibold text-main-text">Wallet controls</h2>
          <p className="mt-2">
            Withdrawals are ledger entries protected by your authenticated session, same-origin
            checks and rate limiting.
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