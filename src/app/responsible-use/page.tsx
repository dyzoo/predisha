import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Responsible use',
}

export default function ResponsibleUsePage() {
  return (
    <PageShell
      eyebrow="Responsible use"
      title="Use analysis as context, not certainty"
      intro="Predisha publishes statistical estimates for informational purposes. It is not a bookmaker and does not accept bets, deposits, or wagers."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Probabilities are not promises</h2>
        <p className="mt-2">
          Every forecast carries uncertainty. A 60% probability does not mean an outcome will happen,
          and it does not imply a profitable bet. Never treat a prediction as a guaranteed result.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">No betting services</h2>
        <p className="mt-2">
          The platform does not place bets, hold funds, settle wagers, or operate as a wallet. Where
          outbound links exist in future, they must be lawful, approved, clearly labelled, and subject
          to local rules.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Age and wellbeing</h2>
        <p className="mt-2">
          Gambling-related content is not directed at minors. If gambling is affecting your finances,
          relationships, or wellbeing, stop and seek local support services. Availability and legal
          status vary by country.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Report a problem</h2>
        <p className="mt-2">
          If a page shows stale, missing, or misleading data, treat it as a bug. We prefer an honest
          empty state over a fabricated statistic.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
