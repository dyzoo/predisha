'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  ClipboardList,
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
import type { BetMode } from '@/lib/bet/mode-copy'
import { BetSlipDock } from './bet-slip-dock'
import { BetSlipProvider, useBetSlip } from './bet-slip-provider'
import { BetModeProvider, useBetMode } from './bet-mode-context'
import { betModeCopy } from '@/lib/bet/mode-copy'
import { BrandLogo } from '@/components/brand-logo'

const NAV = [
  { href: '/bet', label: 'Home', icon: Home },
  { href: '/bet/sports', label: 'Sports', icon: Trophy },
  { href: '/bet/live', label: 'Live', icon: Radio },
  { href: '/bet/bets', label: 'My Bets', icon: Ticket },
  { href: '/bet/games', label: 'Games', icon: Gamepad2 },
  { href: '/bet/promo', label: 'Promotions', icon: Gift },
]

const MOBILE_NAV = [
  { href: '/bet', label: 'Home', icon: Home },
  { href: '/bet/sports', label: 'Sports', icon: Trophy },
  { href: '/bet/live', label: 'Live', icon: Radio },
  { href: '/bet/bets', label: 'My Bets', icon: Ticket },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/bet') return pathname === '/bet'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ShellInner({ viewer, children }: { viewer: ClientViewer; children: ReactNode }) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement | null>(null)
  const { wallet, walletLoading, items, slipOpen, openSlip } = useBetSlip()
  const { mode } = useBetMode()
  const copy = betModeCopy(mode)
  const isGamePage = pathname.startsWith('/bet/games/')

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let last = 0
    let offset = nav.scrollLeft
    let paused = false

    const step = (time: number) => {
      if (!last) last = time
      const elapsed = Math.min(64, time - last)
      last = time
      const max = nav.scrollWidth - nav.clientWidth

      if (!paused && max > 2) {
        offset += elapsed * 0.018
        if (offset >= max - 1) offset = 0
        nav.scrollLeft = offset
      }

      frame = requestAnimationFrame(step)
    }

    const pause = () => {
      paused = true
      offset = nav.scrollLeft
    }
    const resume = () => {
      paused = false
      offset = nav.scrollLeft
      last = 0
    }
    const resumeIfFocusLeft = () => {
      if (!nav.contains(document.activeElement)) resume()
    }

    frame = requestAnimationFrame(step)
    nav.addEventListener('pointerenter', pause)
    nav.addEventListener('pointerleave', resume)
    nav.addEventListener('touchstart', pause, { passive: true })
    nav.addEventListener('touchend', resume)
    nav.addEventListener('focusin', pause)
    nav.addEventListener('focusout', resumeIfFocusLeft)

    return () => {
      cancelAnimationFrame(frame)
      nav.removeEventListener('pointerenter', pause)
      nav.removeEventListener('pointerleave', resume)
      nav.removeEventListener('touchstart', pause)
      nav.removeEventListener('touchend', resume)
      nav.removeEventListener('focusin', pause)
      nav.removeEventListener('focusout', resumeIfFocusLeft)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-main-text">
      {copy.banner ? (
        <div className="border-b border-accent/20 bg-accent/10">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-[11px] leading-relaxed text-accent sm:px-6">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p>{copy.banner}</p>
            <Link href="/bet/how-it-works" className="ml-auto shrink-0 font-semibold underline underline-offset-2">
              How it works
            </Link>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:h-16 sm:gap-3 sm:px-6 sm:py-0">
          <Link
            href="/bet"
            className="flex shrink-0 items-center"
            aria-label="PredishaBet home"
          >
            <BrandLogo priority className="h-8 w-auto sm:h-12 lg:h-14" />
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {viewer.userId ? (
              <>
                <Link
                  href="/bet/account"
                  aria-label={`Wallet balance ${
                    walletLoading && !wallet ? 'loading' : formatTzs(wallet?.balanceMinor ?? 0)
                  }`}
                  className="flex min-w-0 flex-col items-end rounded-xl border border-border bg-surface px-1.5 py-1.5 text-main-text transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-2"
                >
                  <span className="text-[9px] font-medium uppercase leading-none tracking-wide text-muted-text">
                    Balance
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 sm:mt-0 sm:gap-1.5">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-accent sm:h-4 sm:w-4" />
                    <span className="whitespace-nowrap text-[11px] font-bold tabular-nums sm:text-sm">
                      {walletLoading && !wallet ? '…' : formatTzs(wallet?.balanceMinor ?? 0)}
                    </span>
                  </span>
                </Link>
                <Link
                  href="/bet/deposit"
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-xl bg-accent px-2 text-[10px] font-bold text-background transition-opacity hover:opacity-90 sm:h-10 sm:px-3 sm:text-xs"
                >
                  Deposit
                </Link>
                <Link
                  href="/bet/withdraw"
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-xl border border-border bg-surface px-2 text-[10px] font-semibold text-main-text transition-colors hover:border-accent/40 sm:h-10 sm:px-3 sm:text-xs"
                >
                  Withdraw
                </Link>
                <Link
                  href="/bet/account"
                  aria-label="Account"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted-text transition-colors hover:text-main-text sm:flex"
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

        <div className="border-t border-border/70">
          <nav
            ref={navRef}
            aria-label="Betting sections"
            className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-6 lg:justify-center"
          >
            {NAV.map(item => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8">{children}</main>

      <footer className="border-t border-border bg-surface/40 pb-24 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-text sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>{copy.footer}</p>
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
          {isGamePage ? (
            <Link
              href="/bet/games"
              aria-current={isActive(pathname, '/bet/games') ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors ${
                isActive(pathname, '/bet/games') ? 'text-accent' : 'text-muted-text'
              }`}
            >
              <Gamepad2 className="h-5 w-5" />
              Games
            </Link>
          ) : (
            <button
              type="button"
              onClick={openSlip}
              aria-label={`Open bet slip with ${items.length} selection${items.length === 1 ? '' : 's'}`}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors ${
                slipOpen ? 'text-accent' : 'text-muted-text'
              }`}
            >
              <span className="relative">
                <ClipboardList className="h-5 w-5" />
                {items.length > 0 ? (
                  <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold tabular-nums text-background">
                    {items.length}
                  </span>
                ) : null}
              </span>
              Betslip
            </button>
          )}
        </div>
      </nav>

      {isGamePage ? null : <BetSlipDock />}
    </div>
  )
}

export function BetShell({
  viewer,
  mode,
  children,
}: {
  viewer: ClientViewer
  mode: BetMode
  children: ReactNode
}) {
  return (
    <BetSlipProvider viewer={viewer}>
      <BetModeProvider mode={mode}>
        <ShellInner viewer={viewer}>{children}</ShellInner>
      </BetModeProvider>
    </BetSlipProvider>
  )
}
