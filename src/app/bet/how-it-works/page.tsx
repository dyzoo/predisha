import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale, ShieldCheck, Wallet } from 'lucide-react'
import { SectionHeading } from '@/components/bet/section-heading'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How PredishaBet generates simulated odds and settles tickets and games.',
}

export default async function BetHowItWorksPage() {
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)

  const sections = [
    { title: copy.walletsTitle, body: copy.walletsBody },
    { title: copy.oddsTitle, body: copy.oddsBody },
    { title: copy.frozenTitle, body: copy.frozenBody },
    { title: copy.serverTitle, body: copy.serverBody },
    { title: copy.ticketTitle, body: copy.ticketBody },
    { title: copy.gameTitle, body: copy.gameBody },
  ]

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Transparency"
        title="How PredishaBet works"
        description={mode === 'SANDBOX' ? 'A play-money sportsbook built to avoid the payment and odds problems of the original flow.' : 'A transparent sportsbook built to avoid the payment and odds problems of the original flow.'}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: 'No PINs',
            body: 'No form asks for a mobile-money PIN or payment approval.',
          },
          {
            icon: Scale,
            title: 'Auditable prices',
            body: 'Model probabilities plus a published margin, frozen per request.',
          },
          {
            icon: Wallet,
            title: 'Server-owned wallets',
            body: 'Every balance change is a stored, idempotent transaction.',
          },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.title} className="rounded-2xl border border-border bg-surface/80 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-text">{item.body}</p>
            </div>
          )
        })}
      </div>

      <div className="space-y-3">
        {sections.map(section => (
          <section key={section.title} className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-lg font-semibold">{section.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-text">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5 text-sm leading-relaxed text-accent">
        <p className="font-semibold">Limits</p>
        <p className="mt-1 text-accent/80">
          Stakes are limited to 500 to 500,000 TZS per ticket, payouts to 20,000,000 TZS, and tickets to
          20 selections. Share codes expire after 24 hours. These limits are platform controls, not
          real wagering terms.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/bet/sports"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Open the sportsbook
        </Link>
        <Link
          href="/methodology"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
        >
          Prediction methodology
        </Link>
        <Link
          href="/responsible-use"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
        >
          Responsible use
        </Link>
      </div>
    </div>
  )
}

export const instant = false