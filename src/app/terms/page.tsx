import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Terms',
}

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms of service"
      intro="This page is a placeholder. It is not legal advice, and final terms require review for the operating entity, target markets, and subscription model."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Status</h2>
        <p className="mt-2">
          No binding terms are published yet. Do not treat this page as a contract. Before launch, a
          qualified advisor must draft and review terms covering subscriptions, acceptable use,
          liability, and applicable consumer protections.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Product scope</h2>
        <p className="mt-2">
          Predisha is intended to provide informational sports analysis. It must not be configured to
          accept bets, hold wagering funds, or settle bets.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
