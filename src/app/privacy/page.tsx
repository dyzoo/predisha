import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Privacy',
}

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy policy"
      intro="This page is a placeholder. It is not legal advice, and a final policy requires review of the data actually collected, retention, processors, and target markets."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Status</h2>
        <p className="mt-2">
          Authentication and billing are not enabled in this build. When they are, this policy must
          describe account data, preferences, payment metadata (never raw card data), retention, and
          deletion or export requests.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Data minimisation</h2>
        <p className="mt-2">
          Collect only what the product needs. Keep provider and payment secrets server-side, never
          log sensitive payloads, and avoid retaining unnecessary personal data.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
