import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowRight, CreditCard, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { SettingsNav } from '@/components/settings/settings-nav'
import { SettingsLocked } from '@/components/settings/settings-locked'
import { HarakaPayCheckout } from '@/components/billing/harakapay-checkout'
import { getBillingProvider, isBillingEnabled } from '@/lib/billing/provider'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { getPublicPlans, type PublicPlan } from '@/lib/billing/plans'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Billing',
}

export default async function BillingSettingsPage() {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Settings" title="Billing">
        <SettingsNav active="/settings/billing" />
        <SettingsLocked />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/settings/billing')

  const [subscription, plans] = await Promise.all([
    prisma.subscription
      .findUnique({
        where: { userId: viewer.userId },
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          plan: { select: { name: true, interval: true, amountMinor: true, currency: true } },
        },
      })
      .catch(() => null),
    Promise.resolve(getPublicPlans()),
  ])

  const price = subscription
    ? new Intl.NumberFormat('en', {
        style: 'currency',
        currency: subscription.plan.currency,
      }).format(subscription.plan.amountMinor / 100)
    : null

  const provider = getBillingProvider().name
  const billingEnabled = isBillingEnabled()
  const availablePlans: PublicPlan[] = plans.plans.filter(item => item.available)

  return (
    <PageShell
      eyebrow="Settings"
      title="Billing"
      intro="Subscription status and payment controls. No card details are stored or displayed by Predisha."
    >
      <SettingsNav active="/settings/billing" />

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Current subscription
        </h2>
        {subscription ? (
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="text-muted-text">Plan</dt>
              <dd className="mt-1 font-semibold text-main-text">
                {subscription.plan.name} · {subscription.plan.interval.toLowerCase()}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="text-muted-text">Price</dt>
              <dd className="mt-1 font-semibold text-main-text">{price}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="text-muted-text">Status</dt>
              <dd className="mt-1 font-semibold text-main-text">{subscription.status}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="text-muted-text">Renews / ends</dt>
              <dd className="mt-1 font-semibold text-main-text">
                {subscription.currentPeriodEnd
                  ? subscription.currentPeriodEnd.toISOString().slice(0, 10)
                  : 'Not scheduled'}
                {subscription.cancelAtPeriodEnd ? ' (cancels)' : ''}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-xs leading-relaxed">
            You do not have an active subscription. The free tier remains available.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <CreditCard className="h-4 w-4 text-accent" />
          Payment controls
        </h2>
        {provider === 'harakapay' && billingEnabled ? (
          <>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3.5 text-xs leading-relaxed text-muted-text">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p>
                HarakaPay collects premium subscriptions through a USSD push to the phone number you
                provide. Approve the payment on your handset; Predisha does not store or handle card
                details.
              </p>
            </div>
            {availablePlans.length > 0 ? (
              <HarakaPayCheckout plans={availablePlans} />
            ) : (
              <p className="mt-3 text-xs leading-relaxed">
                No subscription plans are published yet. Check back once pricing is configured.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-muted-text"
              >
                Manage payment method
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed">
              The HarakaPay USSD flow does not expose a hosted portal, so payment methods are managed
              in the HarakaPay app.
            </p>
          </>
        ) : (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3.5 text-xs leading-relaxed text-muted-text">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              Subscriptions are not open yet. Checkout stays disabled until the payment provider
              approves the business model, entity and target markets.
            </p>
          </div>
        )}
        {provider === 'harakapay' && billingEnabled ? (
          <p className="mt-3 text-[11px] leading-relaxed">
            Live billing is enabled for the HarakaPay provider. USSD payments settle directly with the
            network and provider.
          </p>
        ) : null}
        <Link
          href="/pricing"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          View plan configuration
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </PageShell>
  )
}

export const instant = false
