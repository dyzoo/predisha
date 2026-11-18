'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Check, CircleAlert, Loader2, Smartphone, ShieldCheck } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { betModeCopy } from '@/lib/bet/mode-copy'
import { MAX_DEPOSIT_MINOR, type BetWalletView } from '@/lib/bet/types'
import { useBetSlip } from './bet-slip-provider'
import { useBetMode } from './bet-mode-context'

const WITHDRAWAL_QUICK_AMOUNTS = [1_000, 5_000, 10_000, 50_000]
const DEPOSIT_AMOUNT_MULTIPLIERS = [1, 2, 5, 10]

function depositQuickAmounts(minimumMinor: number): number[] {
  const amounts = DEPOSIT_AMOUNT_MULTIPLIERS.map(multiplier => minimumMinor * multiplier).filter(
    amount => amount <= MAX_DEPOSIT_MINOR,
  )
  return amounts.length > 0 ? amounts : [minimumMinor]
}

export function WalletAmountForm({
  mode,
  wallet,
}: {
  mode: 'deposit' | 'withdraw'
  wallet: BetWalletView
}) {
  const router = useRouter()
  const { refreshWallet } = useBetSlip()
  const { mode: platformMode, depositMinMinor } = useBetMode()
  const copy = betModeCopy(platformMode)
  const [amountMinor, setAmountMinor] = useState(() => depositMinMinor)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const isDeposit = mode === 'deposit'
  const isLive = platformMode === 'LIVE'
  const needsPhone = !isDeposit || isLive
  const minAmountMinor = isDeposit ? depositMinMinor : 1
  const quickAmounts = isDeposit
    ? depositQuickAmounts(minAmountMinor)
    : WITHDRAWAL_QUICK_AMOUNTS

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setOrderId(null)
    if (needsPhone && phone.trim().length < 7) {
      setError(
        isDeposit
          ? 'Enter the mobile-money number that will approve the deposit.'
          : 'Enter the mobile-money number that should receive the transfer.',
      )
      return
    }
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
        setSuccess(
          `Approve the mobile-money prompt to add ${formatTzs(amountMinor)} to your wallet.`,
        )
        await refreshWallet()
        return
      }

      const response = await fetch(`/api/bet/wallet/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isDeposit ? { amountMinor } : { amountMinor, phone }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        wallet?: BetWalletView
        duplicate?: boolean
        transfer?: { phoneMasked: string; amountMinor: number; status: string }
      }
      if (!response.ok) {
        setError(payload.error ?? 'The wallet could not be updated.')
        return
      }
      setSuccess(
        payload.duplicate
          ? 'That request was already processed. Your balance is unchanged.'
          : isDeposit
            ? `Added ${formatTzs(amountMinor)} to your wallet.`
            : `${formatTzs(amountMinor)} withdrawal successful. The money was sent to ${
                payload.transfer?.phoneMasked ?? phone
              }.`,
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
        {isDeposit ? copy.depositTitle : 'Mobile-money withdrawal'}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {isDeposit ? copy.addFunds : 'Withdraw to mobile money'}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-text">
        {isDeposit
          ? copy.depositDescription
          : 'Enter the amount and the mobile-money number. Withdrawals are approved instantly and sent to this number without a payment prompt.'}
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-text">Current balance</p>
        <p className="mt-1 font-mono text-2xl font-black tabular-nums text-main-text">
          {formatTzs(wallet.balanceMinor)}
        </p>
      </div>

      <label htmlFor="wallet-amount" className="mt-5 block text-xs font-medium text-muted-text">
        Amount (TZS)
      </label>
      <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
        <input
          id="wallet-amount"
          type="number"
          min={minAmountMinor}
          max={isDeposit ? MAX_DEPOSIT_MINOR : undefined}
          step={1}
          value={amountMinor}
          onChange={event => setAmountMinor(Number(event.target.value))}
          className="w-full bg-transparent py-3 text-lg font-bold tabular-nums outline-none"
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {quickAmounts.map(amount => (
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
      {isDeposit ? (
        <p className="mt-2 text-[11px] text-muted-text">
          Limits: {formatTzs(minAmountMinor)} to {formatTzs(MAX_DEPOSIT_MINOR)} per request.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[11px] text-muted-text">
            No withdrawal cap. You can withdraw your full balance of {formatTzs(wallet.balanceMinor)}.
          </p>
          <button
            type="button"
            onClick={() => setAmountMinor(wallet.balanceMinor)}
            disabled={wallet.balanceMinor < 1}
            className="mt-2 w-full rounded-lg border border-accent/40 bg-accent/10 px-2 py-2 text-[11px] font-bold text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Withdraw all ({formatTzs(wallet.balanceMinor)})
          </button>
        </>
      )}

      {needsPhone ? (
        <>
          <label htmlFor="wallet-phone" className="mt-5 block text-xs font-medium text-muted-text">
            {isDeposit ? 'Mobile-money number' : 'Receiving mobile number'}
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
            <Smartphone className="h-4 w-4 shrink-0 text-muted-text" />
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
          <p className="mt-2 text-[11px] text-muted-text">
            {isDeposit
              ? 'Approve the prompt on your phone to credit your wallet instantly.'
              : 'The withdrawal is sent to this number instantly.'}
          </p>
        </>
      ) : null}

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
        <div
          role="status"
          className="mt-4 rounded-3xl border border-accent/30 bg-accent/10 p-5 text-center sm:p-6"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Check className="h-7 w-7" />
          </span>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            {isDeposit ? 'Deposit confirmed' : 'Withdrawal successful'}
          </p>
          {!isDeposit ? (
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-main-text">
              {formatTzs(amountMinor)}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-muted-text">{success}</p>
          {orderId ? (
            <span className="mt-2 block text-[10px] text-accent/70">Reference: {orderId}</span>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading
          ? 'Working'
          : isDeposit
            ? `Deposit ${formatTzs(amountMinor)}`
            : `Withdraw ${formatTzs(amountMinor)}`}
      </button>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-text">
        <span>{isDeposit ? 'Mobile-money deposits' : 'Instant mobile-money withdrawals'}</span>
        <Link href="/bet/account" className="font-semibold text-accent hover:underline">
          Wallet
        </Link>
      </div>
    </form>
  )
}
