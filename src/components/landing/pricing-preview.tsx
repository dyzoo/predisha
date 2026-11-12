import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { getPublicPlans, type PublicPlan } from '@/lib/billing/plans'
import { getViewer } from '@/lib/auth/session'
import { Reveal } from '@/components/ui/reveal'

const freeFeatures = [
  'A limited daily match preview',
  'Transparent multi-market probabilities',
  'Data freshness timestamps',
  'Saved match limit',
]

function formatPrice(plan: PublicPlan): string {
  if (!plan.available || plan.amountMinor === null) return 'Not published'
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: plan.currency,
      minimumFractionDigits: 2,
    }).format(plan.amountMinor / 100)
  } catch {
    return `${plan.amountMinor / 100} ${plan.currency}`
  }
}

export async function PricingPreview() {
  const { plans, billingEnabled, notice, provider } = getPublicPlans()
  const viewer = await getViewer()
  const signedIn = Boolean(viewer.userId)

  return (
    <section className="border-y border-border bg-surface/25 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Plans</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Start free, upgrade when it earns it
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-text sm:text-base">
            Prices and plan availability are configuration, not hardcoded promises. Billing remains
            disabled until a payment provider approves the business model and target markets.
          </p>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-border bg-background/40 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Free</h3>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                  Preview
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-text">A limited look at the board each day.</p>
              <p className="mt-5 font-display text-2xl font-bold">$0</p>
              <ul className="mt-6 space-y-3">
                {freeFeatures.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-text">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={signedIn ? '/dashboard' : '/sign-up'}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-elevated-surface"
              >
                {signedIn ? 'Go to dashboard' : 'Create free account'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          {plans.map((plan, index) => (
            <Reveal key={plan.id} delay={0.06 * (index + 1)}>
              <div
                className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 ${
                  index === plans.length - 1
                    ? 'border-accent/30 bg-gradient-to-b from-accent/[0.08] to-transparent'
                    : 'border-border bg-background/40'
                }`}
              >
                {!plan.available ? (
                  <div className="absolute right-4 top-4 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    {billingEnabled ? 'Setup incomplete' : 'Coming soon'}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-text">
                  {plan.interval === 'WEEKLY' ? 'Billed every week.' : 'Billed every month.'}
                </p>
                <p className="mt-5 font-display text-2xl font-bold">
                  {formatPrice(plan)}
                  {plan.available ? (
                    <span className="ml-1 text-xs font-medium text-muted-text">
                      / {plan.interval.toLowerCase()}
                    </span>
                  ) : null}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-text">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
                {plan.available ? (
                  <Link
                    href="/settings/billing"
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
                  >
                    {provider === 'manual' ? 'Activate test plan' : 'Upgrade with HarakaPay'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-auto cursor-not-allowed rounded-xl bg-accent/20 px-5 py-3 text-sm font-semibold text-accent/60"
                  >
                    Subscriptions coming soon
                  </button>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-background/40 px-4 py-3 text-center text-xs leading-relaxed text-muted-text">
          {notice} No card details are collected or stored by this application.
        </p>
      </div>
    </section>
  )
}
