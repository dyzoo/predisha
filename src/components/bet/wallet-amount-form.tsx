'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { CircleAlert, Loader2, ShieldCheck } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { betModeCopy } from '@/lib/bet/mode-copy'
import type { BetWalletView } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'

const QUICK_AMOUNTS = [5_000, 10_000, 50_000, 100_000]

export function WalletAmountForm({
  mode,
  wallet,
}: {
  mode: 'deposit' | 'withdraw'
  wallet: BetWalletView
}) {
  const router = useRouter()
  const { refreshWallet } = useBetSlip()
  const { mode: platformMode } = useBetMode()
  const copy = betModeCopy(platformMode)
  const [amountMinor, setAmountMinor] = useState(10_000)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const isDeposit = mode === 'deposit'
  const isLive = platformMode === 'LIVE'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (isDeposit && isLive) {
        const response = await fetch('/api/bet/wallet/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountMinor, phone }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          order?: { orderId: string; status: string; paid: boolean }
          wallet?: BetWalletView
        }
        if (!response.ok) {
          setError(payload.error ?? 'The mobile-money deposit could not be started.')
          return
        }
        if (!payload.order?.orderId) {
          setError('The mobile-money deposit could not be started.')
          return
        }
        setOrderId(payload.order.orderId)
        setSuccess('Awaiting the mobile-money prompt on your phone.')
        await refreshWallet()
        return
      }

      const response = await fetch(`/api/bet/wallet/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        wallet?: BetWalletView
        duplicate?: boolean
      }
      if (!response.ok) {
        setError(payload.error ?? 'The wallet could not be updated.')
        return
      }
      setSuccess(
        payload.duplicate
          ? 'That request was already processed. Your balance is unchanged.'
          : `${isDeposit ? 'Added' : 'Withdrew'} ${formatTzs(amountMinor)}.`,
      )
      await refreshWallet()
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-surface/80 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        <ShieldCheck className="h-4 w-4" />
        {isDeposit ? copy.depositTitle : copy.withdrawTitle}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {isDeposit ? copy.addFunds : copy.withdrawTitle}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-text">
        {isDeposit ? copy.depositDescription : copy.withdrawDescription}
      </p>

      <div className="mt-5 rounded-xl bg-background/40 p-3 text-sm">
        <span className="text-muted-text">Current balance</span>
        <span className="ml-2 font-semibold tabular-nums">{formatTzs(wallet.balanceMinor)}</span>
      </div>

      {isDeposit && isLive ? (
        <label htmlFor="wallet-phone" className="mt-5 block text-xs font-medium text-muted-text">
          Mobile-money number
        </label>
      ) : (
        <label htmlFor="wallet-amount" className="mt-5 block text-xs font-medium text-muted-text">
          Amount (TZS)
        </label>
      )}
      {isDeposit && isLive ? (
        <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
          <input
            id="wallet-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            className="w-full bg-transparent py-3 text-sm font-semibold tabular-nums outline-none"
          />
        </div>
      ) : (
        <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
          <input
            id="wallet-amount"
            type="number"
            min={1_000}
            max={1_000_000}
            step={500}
            value={amountMinor}
            onChange={event => setAmountMinor(Number(event.target.value))}
            className="w-full bg-transparent py-3 text-lg font-bold tabular-nums outline-none"
          />
        </div>
      )}
      {isDeposit && isLive ? (
        <p className="mt-2 text-[11px] text-muted-text">
          HarakaPay sends a USSD prompt and credits your wallet after you approve it.
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => setAmountMinor(amount)}
                className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-text transition-colors hover:border-accent/40 hover:text-accent"
              >
                {formatTzs(amount)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-text">Limits: 1,000 TZS to 1,000,000 TZS per request.</p>
        </>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
          {success}
          {orderId ? (
            <span className="mt-1 block text-[10px] text-accent/70">Reference: {orderId}</span>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? 'Working' : isDeposit ? `Deposit ${formatTzs(amountMinor)}` : `Withdraw ${formatTzs(amountMinor)}`}
      </button>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-text">
        <span>{isLive ? 'Live payments via HarakaPay.' : 'Play money ledger.'}</span>
        <Link href="/bet/account" className="font-semibold text-accent hover:underline">
          Wallet
        </Link>
      </div>
    </form>
  )
}