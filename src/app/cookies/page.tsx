import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Cookies',
}

export default function CookiesPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Cookie policy"
      intro="This page is a placeholder. It is not legal advice. A final cookie policy must list the categories actually used, their purposes, retention, and the consent mechanism required in each market."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Current use</h2>
        <p className="mt-2">
          This build does not enable analytics, advertising, or billing cookies. Session cookies
          become relevant only when authentication is configured. No cookie consent banner is shown
          for functionality that is not active.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Before launch</h2>
        <p className="mt-2">
          Inventory every cookie and similar technology, classify it as strictly necessary or
          optional, and implement a consent flow that meets the rules of the target markets. Do not
          treat implied consent as sufficient where explicit consent is required.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
