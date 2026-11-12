'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  Gamepad2,
  Gift,
  Home,
  Radio,
  ShieldAlert,
  Ticket,
  Trophy,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { ClientViewer } from '@/lib/auth/entitlements'
import { formatTzs } from '@/lib/bet/format'
import { BetSlipDock } from './bet-slip-dock'
import { BetSlipProvider, useBetSlip } from './bet-slip-provider'

const NAV = [
  { href: '/bet', label: 'Home', icon: Home },
  { href: '/bet/sports', label: 'Sports', icon: Trophy },
  { href: '/bet/live', label: 'Live', icon: Radio },
  { href: '/bet/bets', label: 'My bets', icon: Ticket },
  { href: '/bet/games', label: 'Games', icon: Gamepad2 },
  { href: '/bet/promo', label: 'Promo', icon: Gift },
]

const MOBILE_NAV = NAV.slice(0, 5)

function isActive(pathname: string, href: string): boolean {
  if (href === '/bet') return pathname === '/bet'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ShellInner({ viewer, children }: { viewer: ClientViewer; children: ReactNode }) {
  const pathname = usePathname()
  const { wallet, walletLoading } = useBetSlip()

  return (
    <div className="min-h-screen bg-background text-main-text">
      <div className="border-b border-accent/20 bg-accent/10">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-[11px] leading-relaxed text-accent sm:px-6">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>
            Sandbox mode: every balance and payout is play money. No real deposits, withdrawals or
            mobile-money PINs are collected.{' '}
            <Link href="/bet/how-it-works" className="font-semibold underline underline-offset-2">
              How it works
            </Link>
          </p>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/bet" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-black text-background">
              PB
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Predisha<span className="text-accent">Bet</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Betting sections">
            {NAV.map(item => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted-text hover:bg-surface hover:text-main-text'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {viewer.userId ? (
              <>
                <Link
                  href="/bet/account"
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-main-text transition-colors hover:border-accent/40"
                >
                  <Wallet className="h-4 w-4 text-accent" />
                  <span className="tabular-nums">
                    {walletLoading && !wallet ? '…' : formatTzs(wallet?.balanceMinor ?? 0)}
                  </span>
                </Link>
                <Link
                  href="/bet/account"
                  aria-label="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted-text transition-colors hover:text-main-text"
                >
                  <UserRound className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in?next=/bet"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-muted-text transition-colors hover:text-main-text"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up?next=/bet"
                  className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8">{children}</main>

      <footer className="border-t border-border bg-surface/40 pb-24 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-text sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>
            PredishaBet is a sandbox sportsbook demo. Simulated odds are generated from the
            Predisha model and are not live market prices.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/bet/how-it-works" className="hover:text-accent">
              How it works
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/responsible-use" className="hover:text-accent">
              Responsible use
            </Link>
          </div>
        </div>
      </footer>

      <nav
        aria-label="Mobile betting navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(item => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-muted-text'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <BetSlipDock />
    </div>
  )
}

export function BetShell({ viewer, children }: { viewer: ClientViewer; children: ReactNode }) {
  return (
    <BetSlipProvider viewer={viewer}>
      <ShellInner viewer={viewer}>{children}</ShellInner>
    </BetSlipProvider>
  )
}
