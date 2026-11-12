import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ShieldCheck, UserRound } from 'lucide-react'
import { AuthRequired } from '@/components/bet/auth-required'
import { SectionHeading } from '@/components/bet/section-heading'
import { WalletCard } from '@/components/bet/wallet-card'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { getViewer } from '@/lib/auth/session'
import { getWalletView } from '@/lib/bet/wallet'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your sandbox wallet and Predisha account details.',
}

export default async function BetAccountPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to your wallet"
        description="The sandbox wallet, tickets and game history are tied to your Predisha account."
        nextPath="/bet/account"
      />
    )
  }

  const wallet = await getWalletView(viewer.userId)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Account"
        title="Your sandbox wallet"
        description="Play money only. The betting wallet is separate from any Predisha subscription."
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <WalletCard wallet={wallet} />

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface/80 p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <UserRound className="h-4 w-4" />
              Profile
            </div>
            <p className="mt-3 text-sm font-semibold">{viewer.name ?? 'Predisha player'}</p>
            <p className="text-xs text-muted-text">{viewer.email}</p>
            <p className="mt-3 inline-block rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-text">
              {viewer.entitlement} plan
            </p>
            <div className="mt-4">
              <SignOutButton />
            </div>
          </section>

          <section className="rounded-2xl border border-accent/20 bg-accent/10 p-5 text-xs leading-relaxed text-accent">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Sandbox safety
            </div>
            <p className="mt-2 text-accent/80">
              PredishaBet never asks for a mobile-money PIN, card number or payment approval. If a
              page claims otherwise, close it and report the link.
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/bet/deposit"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"
            >
              Add sandbox funds
            </Link>
            <Link
              href="/bet/bets"
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
            >
              My bets
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export const instant = false
