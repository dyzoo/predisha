import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'About',
  description: 'What Predisha is, what it refuses to do, and how the product is being built.',
}

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="Sports analysis without the casino"
      intro="Predisha is an informational sports analytics product. We publish statistically grounded estimates, show the data behind them, and never accept bets or promise outcomes."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">What this is</h2>
        <p className="mt-2">
          A subscription product for football fans who want transparent probabilities, input
          timestamps and an honest record. The first release focuses on football, covering 1X2,
          double chance, goal totals and both-teams-to-score. Other sports and markets are added only
          after validation.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">What this is not</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Not a bookmaker. We do not accept bets, hold funds, or settle wagers.</li>
          <li>Not a guarantee. Every probability carries uncertainty.</li>
          <li>Not a place for fabricated fixtures, statistics, or performance claims.</li>
          <li>Not directed at minors.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">How the model works</h2>
        <p className="mt-2">
          The baseline combines an Elo-style rating with home advantage and a Poisson goal model. Only
          information available before the prediction cutoff is used. Language models, when enabled,
          write explanations from verified facts; they never generate probabilities.
        </p>
        <Link
          href="/methodology"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          Read the full methodology
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Current status</h2>
        <p className="mt-2">
          This build runs on clearly labelled fictional demo data in development. Production sports
          credentials and billing approval are not configured, so live fixtures and subscriptions
          remain disabled rather than faked.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
