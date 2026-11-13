import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PromoList } from '@/components/bet/promo-list'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { listPromos } from '@/lib/bet/promos'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Promos',
  description: 'Claim bonuses. No deposit or payment method required.',
}

export default async function BetPromoPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  const promos = await listPromos(viewer.userId ?? undefined, mode)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Promotions"
        title={copy.promosTitle}
        description={copy.promosDescription}
      />
      <PromoList promos={promos} signedIn={Boolean(viewer.userId)} />
      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-xs leading-relaxed text-muted-text">
        {mode === 'SANDBOX'
          ? 'Promo credit is added to your play-money wallet through the same ledger as every other transaction. It cannot be withdrawn as real money, transferred, or redeemed for cash.'
          : 'Promo credit is added to your betting wallet through the same ledger as every other transaction. It cannot be withdrawn as real money, transferred, or redeemed for cash.'}
      </div>
    </div>
  )
}

export const instant = false