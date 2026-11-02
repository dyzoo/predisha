'use client'

import {
  ArrowRight,
  BarChart3,
  CircleCheck,
  Clock3,
  Database,
  LineChart,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'

const features = [
  {
    icon: BarChart3,
    title: 'Probabilities, not picks',
    body: 'Every market returns calibrated outcome probabilities with the model version and the exact data snapshot used.',
  },
  {
    icon: Clock3,
    title: 'Freshness first',
    body: 'Kickoffs are stored in UTC and shown in your timezone. Stale or incomplete inputs are flagged — never guessed.',
  },
  {
    icon: LineChart,
    title: 'An honest record',
    body: 'Saved prediction slips keep the probabilities from build time, then are scored with Brier scores after full time. Misses stay visible.',
  },
]

const pipeline = [
  { icon: Database, label: 'Provider sync', detail: 'Fixtures, form, results' },
  { icon: Workflow, label: 'Feature set', detail: 'Only pre-match data' },
  { icon: ShieldCheck, label: 'Validation', detail: 'Finite, sums to 1' },
  { icon: CircleCheck, label: 'Evaluation', detail: 'Scored after full time' },
]

export function Features({
  health,
}: {
  health: { ok: boolean; mode: 'demo' | 'live' | 'stored' | 'unavailable'; message: string }
}) {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Why Predisha
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Built on evidence, not vibes
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-text sm:text-base">
            The model explains what the data supports. When the inputs are thin, the product says so
            instead of manufacturing a prediction.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <div className="h-full rounded-2xl border border-border bg-surface/60 p-6 transition-colors hover:border-white/20">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-text">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  Model pipeline
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">
                  From provider feed to scored prediction
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-text">
                  Every step is logged. If a data-quality gate fails, the prediction is withheld and
                  the UI shows an insufficient-data state.
                </p>
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3.5">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      health.ok ? 'bg-accent' : 'bg-red-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold">
                      {!health.ok
                        ? 'Provider unavailable'
                        : health.mode === 'demo'
                          ? 'Demo data active'
                          : health.mode === 'stored'
                            ? 'Stored data active'
                            : 'Provider reachable'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-text">{health.message}</p>
                  </div>
                </div>
              </div>

              <ol className="grid gap-3 sm:grid-cols-2">
                {pipeline.map((step, index) => (
                  <li
                    key={step.label}
                    className="relative rounded-xl border border-border bg-elevated-surface/60 p-4"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-text">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-[10px] text-accent">
                        {index + 1}
                      </span>
                      {step.label}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                      <step.icon className="h-4 w-4 text-accent" />
                      {step.detail}
                    </div>
                    {index < pipeline.length - 1 ? (
                      <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-text/40 sm:block" />
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
