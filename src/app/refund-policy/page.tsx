import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Refund policy',
}

export default function RefundPolicyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Refund policy"
      intro="This page is a placeholder. It is not legal advice. A final refund policy requires review of the operating entity, payment provider rules, and consumer protection law in each market."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Status</h2>
        <p className="mt-2">
          Subscriptions are not enabled and no payments are accepted in this build. No refund promise
          is made until a payment provider is approved and final terms are published.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Before enabling billing</h2>
        <p className="mt-2">
          Define cancellation timing, renewal terms, trial rules, failed-payment handling, and
          statutory withdrawal rights. The policy must match the actual billing provider behaviour
          and the customer&apos;s jurisdiction.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
