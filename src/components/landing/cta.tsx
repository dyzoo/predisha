import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'

export function CallToAction() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-elevated-surface px-6 py-12 text-center sm:px-10 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[420px] -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]"
            />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Matchday ready
              </span>
              <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Follow the fixtures. See the reasoning.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-text sm:text-base">
                Create a free account to save matches and keep your preferences across devices. No
                card required.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
                >
                  Create free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/matches"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-6 py-3.5 text-sm font-semibold text-main-text transition-colors hover:bg-background/70"
                >
                  Browse matches
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
