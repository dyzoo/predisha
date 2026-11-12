import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, History, Wallet } from 'lucide-react'
import {
  formatDateTimeLabel,
  formatTzs,
  signedTzs,
  transactionLabel,
} from '@/lib/bet/format'
import type { BetWalletView } from '@/lib/bet/types'

export function WalletCard({
  wallet,
  showTransactions = true,
}: {
  wallet: BetWalletView
  showTransactions?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface/80">
      <div className="bg-gradient-to-br from-accent/20 via-surface to-surface p-6">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          <Wallet className="h-4 w-4" />
          Sandbox wallet
        </div>
        <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
          {formatTzs(wallet.balanceMinor)}
        </p>
        <p className="mt-1 text-xs text-muted-text">
          Play money only · no real deposits or withdrawals
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/bet/deposit"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Add sandbox funds
          </Link>
          <Link
            href="/bet/withdraw"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/30 px-4 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Withdraw
          </Link>
          <Link
            href="/bet/bets"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/30 px-4 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
          >
            <History className="h-4 w-4" />
            My bets
          </Link>
        </div>
      </div>

      {showTransactions ? (
        <div className="border-t border-border p-4">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          {wallet.transactions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-text">
              No sandbox transactions yet. Add play funds to start.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {wallet.transactions.map(transaction => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{transactionLabel(transaction.type)}</p>
                    <p className="text-[11px] text-muted-text">
                      {formatDateTimeLabel(transaction.createdAt)}
                      {transaction.note ? ` · ${transaction.note}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-semibold tabular-nums ${
                        transaction.amountMinor >= 0 ? 'text-accent' : 'text-main-text'
                      }`}
                    >
                      {signedTzs(transaction.amountMinor)}
                    </p>
                    <p className="text-[11px] text-muted-text tabular-nums">
                      {formatTzs(transaction.balanceAfterMinor)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
