import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PromoList } from '@/components/bet/promo-list'
import { SectionHeading } from '@/components/bet/section-heading'
import { getViewer } from '@/lib/auth/session'
import { listPromos } from '@/lib/bet/promos'

export const metadata: Metadata = {
  title: 'Promos',
  description: 'Claim sandbox play-money bonuses. No deposit or payment method required.',
}

export default async function BetPromoPage() {
  await connection()
  const viewer = await getViewer()
  const promos = await listPromos(viewer.userId ?? undefined)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Promotions"
        title="Sandbox bonuses"
        description="One claim per promo per account. Bonuses are play money with no cash value."
      />
      <PromoList promos={promos} signedIn={Boolean(viewer.userId)} />
      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-xs leading-relaxed text-muted-text">
        Promo credit is added to your sandbox wallet through the same ledger as every other
        transaction. It cannot be withdrawn as real money, transferred, or redeemed for cash.
      </div>
    </div>
  )
}

export const instant = false
