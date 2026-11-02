import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How Predisha generates and evaluates football predictions.',
}

export default function MethodologyPage() {
  return (
    <PageShell
      eyebrow="Transparency"
      title="Prediction methodology"
      intro="Predictions are statistical estimates, not certainties. This page explains what the model uses, what it refuses to do, and how performance is measured."
    >
      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">What the model does</h2>
        <p className="mt-2">
          The first release focuses on football: 1X2 (home win, draw, away win), double chance, goal
          totals and both-teams-to-score. Probabilities come from a deterministic statistical
          baseline — an Elo-style rating with home advantage, moving toward a Poisson goal model as
          validation improves. The derived markets are calculated from the same Poisson score
          distribution. Language models are used only to write explanations from verified structured
          facts, never to invent probabilities.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">No future-data leakage</h2>
        <p className="mt-2">
          Only information available before the prediction timestamp is allowed into the feature set.
          Final scores, post-match data, and future odds are excluded. Predictions are stored before
          kickoff and are never silently rewritten afterwards.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Data-quality gates</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Probabilities must be finite, within 0–1, and sum to approximately 1.</li>
          <li>Mutually exclusive outcomes must be exhaustive before a prediction is published.</li>
          <li>Stale or incomplete inputs are rejected: the UI shows an insufficient-data state.</li>
          <li>Every prediction records its model version and the timestamp of its input snapshot.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Evaluation</h2>
        <p className="mt-2">
          Finished matches are scored with Brier score and log loss, with calibration reviewed by
          probability bucket. Accuracy is reported as a secondary metric alongside sample size and
          date range. Backtests are kept separate from prospective results. Performance claims are
          withheld until the sample size and method are adequate.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Current status</h2>
        <p className="mt-2">
          This build ships the product interface, data contracts, and validation rules. A production
          sports data provider and a validated model are not enabled yet, so no live forecasts or
          performance figures are shown. Demo fixtures are fictional and labelled as such in local
          development only.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-main-text">Limitations</h2>
        <p className="mt-2">
          Football is low-scoring and noisy. A high probability is not a guarantee, and no model can
          eliminate uncertainty. Predisha does not accept bets, hold funds, or promise profitability.
        </p>
      </section>
    </PageShell>
  )
}

export const instant = false
