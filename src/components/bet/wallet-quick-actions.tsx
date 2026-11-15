'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CircleHelp, Wallet, X } from 'lucide-react'

const HINT_KEY = 'spotibet:wallet-actions-hint'

function hasSeenHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

function markHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_KEY, '1')
  } catch {
    return
  }
}

export function WalletQuickActions({
  signedIn,
  walletDisplay,
  walletHref,
  depositHref,
  withdrawHref,
}: {
  signedIn: boolean
  walletDisplay: string
  walletHref: string
  depositHref: string
  withdrawHref: string
}) {
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (hasSeenHint()) return
    const timer = window.setTimeout(() => {
      setHelpOpen(true)
      markHintSeen()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [])

  const dismissHelp = useCallback(() => {
    setHelpOpen(false)
    markHintSeen()
  }, [])

  const toggleHelp = useCallback(() => {
    setHelpOpen(value => !value)
    markHintSeen()
  }, [])

  useEffect(() => {
    if (!helpOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissHelp()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissHelp, helpOpen])

  const guide = helpOpen ? (
    <div
      id="wallet-quick-actions-guide"
      role="dialog"
      aria-label="Wallet quick actions guide"
      className="fixed inset-x-3 bottom-20 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-background/95 p-3 text-left shadow-2xl shadow-black/20 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-52 sm:top-1/2 sm:w-72 sm:-translate-y-1/2"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-main-text">Quick wallet actions</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-text">
            One tap to check, add, or move your money.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissHelp}
          aria-label="Close wallet guide"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-text transition-colors hover:bg-surface hover:text-main-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        <li className="flex items-start gap-2 rounded-xl bg-surface/70 p-2">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="text-[11px] leading-relaxed text-muted-text">
            <span className="font-semibold text-main-text">Wallet</span> shows your balance and
            recent transactions.
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-xl bg-surface/70 p-2">
          <ArrowDownToLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="text-[11px] leading-relaxed text-muted-text">
            <span className="font-semibold text-main-text">Deposit</span> adds money before you place
            a bet.
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-xl bg-surface/70 p-2">
          <ArrowUpFromLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-text" />
          <span className="text-[11px] leading-relaxed text-muted-text">
            <span className="font-semibold text-main-text">Withdraw</span> moves available winnings
            out of your wallet.
          </span>
        </li>
      </ul>

      {!signedIn ? (
        <p className="mt-2 rounded-xl border border-accent/20 bg-accent/10 p-2 text-[10px] font-medium leading-relaxed text-accent">
          Sign in or create an account to deposit, withdraw, or place bets.
        </p>
      ) : null}
    </div>
  ) : null

  return (
    <>
      {guide}

      <div className="fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-2 sm:right-4">
        <Link
          href={walletHref}
          onClick={dismissHelp}
          title="Wallet"
          aria-label={
            signedIn
              ? `Wallet balance ${walletDisplay}`
              : 'Sign in or create an account to use your wallet'
          }
          className="group flex h-11 items-center gap-2 rounded-full border border-border bg-background/95 px-2.5 text-main-text shadow-lg shadow-black/10 backdrop-blur transition-all hover:-translate-x-0.5 hover:border-accent/40 hover:bg-surface sm:px-3"
        >
          <Wallet className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-[10px] font-semibold sm:text-xs">Wallet</span>
          <span className="hidden font-mono text-[11px] font-bold tabular-nums text-muted-text lg:inline">
            {walletDisplay}
          </span>
        </Link>

        <Link
          href={depositHref}
          onClick={dismissHelp}
          title="Deposit"
          aria-label={signedIn ? 'Deposit funds' : 'Sign in or create an account to deposit funds'}
          className="group flex h-11 items-center gap-2 rounded-full border border-accent/30 bg-accent px-2.5 text-background shadow-lg shadow-accent/20 transition-all hover:-translate-x-0.5 hover:opacity-90 sm:px-3"
        >
          <ArrowDownToLine className="h-4 w-4 shrink-0" />
          <span className="text-[10px] font-semibold sm:text-xs">Deposit</span>
        </Link>

        <Link
          href={withdrawHref}
          onClick={dismissHelp}
          title="Withdraw"
          aria-label={
            signedIn ? 'Withdraw funds' : 'Sign in or create an account to withdraw funds'
          }
          className="group flex h-11 items-center gap-2 rounded-full border border-border bg-background/95 px-2.5 text-main-text shadow-lg shadow-black/10 backdrop-blur transition-all hover:-translate-x-0.5 hover:border-accent/40 hover:bg-surface sm:px-3"
        >
          <ArrowUpFromLine className="h-4 w-4 shrink-0 text-muted-text" />
          <span className="text-[10px] font-semibold sm:text-xs">Withdraw</span>
        </Link>

        <button
          type="button"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-controls="wallet-quick-actions-guide"
          title="How wallet actions work"
          className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/95 px-2.5 text-muted-text shadow-lg shadow-black/10 backdrop-blur transition-colors hover:border-accent/40 hover:text-accent sm:px-3"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          <span className="hidden text-[10px] font-semibold sm:inline">How it works</span>
        </button>
      </div>
    </>
  )
}
