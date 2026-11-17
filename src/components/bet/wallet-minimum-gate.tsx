'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { MIN_WALLET_BALANCE_MINOR } from '@/lib/bet/types'

export function isBelowGameWalletMinimum(balanceMinor: number | null | undefined): boolean {
  return typeof balanceMinor === 'number' && balanceMinor < MIN_WALLET_BALANCE_MINOR
}

export function WalletMinimumNotice({
  balanceMinor,
  className = '',
}: {
  balanceMinor: number | null | undefined
  className?: string
}) {
  if (!isBelowGameWalletMinimum(balanceMinor)) return null

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100 ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        A minimum wallet balance of{' '}
        <span className="font-semibold">{formatTzs(MIN_WALLET_BALANCE_MINOR)}</span> is required to
        play games. Your balance is {formatTzs(balanceMinor ?? 0)}.
      </p>
      <Link
        href="/bet/deposit"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-background"
      >
        Deposit
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
