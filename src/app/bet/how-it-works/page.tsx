import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale, ShieldCheck, Wallet } from 'lucide-react'
import { SectionHeading } from '@/components/bet/section-heading'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How PredishaBet generates simulated odds, protects sandbox wallets and settles tickets and games.',
}

const SECTIONS = [
  {
    title: 'Sandbox money only',
    body: 'Every balance, stake, promo and payout in PredishaBet is play money. Deposits and withdrawals are ledger entries inside the app. There is no card processor, mobile-money request, PIN collection or cash-out path.',
  },
  {
    title: 'Simulated odds',
    body: 'Prices are derived from the Predisha match model. Each outcome probability is converted to decimal odds and a 6% book margin is applied. The odds are labelled as simulated everywhere they appear.',
  },
  {
    title: 'Frozen prices',
    body: 'When you place a bet, the API rebuilds the market, checks that the fixture is still open, and compares the submitted price with the current price. If the difference is larger than 0.02, the bet is rejected so you can review the slip.',
  },
  {
    title: 'Server-owned wallets',
    body: 'Wallets and ledgers live in PostgreSQL. Debits use conditional updates so a balance cannot go negative, and every mutation carries an idempotency reference so retries do not double-charge or double-pay.',
  },
  {
    title: 'Ticket settlement',
    body: 'Tickets settle when the fixture feed reports a final score. Postponed, cancelled and abandoned fixtures void the affected selection. Demo fixtures can be resolved with the sandbox resolver from the ticket screen.',
  },
  {
    title: 'Game fairness',
    body: 'Mines positions are chosen and stored server-side. Aviator crash points are committed deterministically per round. Dice, roulette and slots use server-side random values and store the round detail for review.',
  },
]

export default function BetHowItWorksPage() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Transparency"
        title="How PredishaBet works"
        description="A sandbox sportsbook built to avoid the payment and odds problems of the original flow."
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
            title: 'Play-money ledger',
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
        {SECTIONS.map(section => (
          <section key={section.title} className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-lg font-semibold">{section.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-text">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5 text-sm leading-relaxed text-accent">
        <p className="font-semibold">Limits</p>
        <p className="mt-1 text-accent/80">
          Stakes are limited to 500–500,000 TZS per ticket, payouts to 20,000,000 TZS, and tickets to
          20 selections. Share codes expire after 24 hours. These limits are sandbox controls, not
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
