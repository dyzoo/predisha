'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Plane,
  Smartphone,
  Wallet,
} from 'lucide-react'
import type { AviatorTrialView } from '@/lib/bet/aviator-trial'
import { formatTzs } from '@/lib/bet/format'
import { normalizeTzPhone } from '@/lib/bet/phone'
import { useBetSlip } from './bet-slip-provider'

type Phase = 'idle' | 'validating' | 'done'

const WITHDRAWAL_HOURS = 6

function remainingMs(eta: string | null): number {
  if (!eta) return 0
  return Math.max(0, new Date(eta).getTime() - Date.now())
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}

export function TrialWithdrawalPanel({
  trial: initialTrial,
}: {
  trial: AviatorTrialView
}) {
  const { refreshWallet } = useBetSlip()
  const [trial, setTrial] = useState(initialTrial)
  const [phone, setPhone] = useState('')
  const [phase, setPhase] = useState<Phase>(
    initialTrial.withdrawalStatus === 'PENDING' ? 'done' : 'idle',
  )
  const [remaining, setRemaining] = useState(() =>
    remainingMs(initialTrial.withdrawalEtaAt),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'done' || !trial.withdrawalEtaAt) return
    const timer = window.setInterval(() => {
      setRemaining(remainingMs(trial.withdrawalEtaAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, trial.withdrawalEtaAt])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const normalized = normalizeTzPhone(phone)
    if (!normalized.ok) {
      setError(normalized.error ?? 'Enter a valid mobile number.')
      return
    }

    setPhase('validating')
    try {
      await new Promise(resolve => window.setTimeout(resolve, 7000))

      const response = await fetch('/api/bet/aviator-trial/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized.phone }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        trial?: AviatorTrialView
        error?: string
      }

      if (!response.ok || !payload.trial) {
        setError(payload.error ?? 'The prize payout could not be requested.')
        setPhase('idle')
        return
      }

      setTrial(payload.trial)
      setRemaining(remainingMs(payload.trial.withdrawalEtaAt))
      setPhase('done')
      await refreshWallet()
    } catch {
      setError('Network error. Please try again.')
      setPhase('idle')
    }
  }

  if (trial.status === 'GRANTED') {
    return (
      <section className="rounded-3xl border border-border bg-surface/80 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Plane className="h-6 w-6 -rotate-12" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold">Fly the trial first</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          Your trial flight has not been played yet. Complete the one-flight Aviator trial to unlock
          the prize payout.
        </p>
        <Link
          href="/bet/aviator-trial"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"
        >
          Open Aviator trial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    )
  }

  if (phase === 'done') {
    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl border border-accent/30 bg-surface/80">
          <div className="bg-gradient-to-br from-accent/20 via-surface to-surface p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-background">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Payout approved
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              Prize will be in your account in {WITHDRAWAL_HOURS} hrs
            </h2>
            <p className="mt-2 text-sm text-muted-text">
              {formatTzs(trial.prizeMinor)} is on the way to{' '}
              {trial.phoneMasked ?? 'your mobile-money number'}.
            </p>
          </div>
          <div className="border-t border-border p-6">
            <div className="flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
                <Clock3 className="h-4 w-4" />
                Arrives in
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-main-text">
                {formatCountdown(remaining)}
              </span>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-text">
              Keep this page open for the live counter. Mobile-money payouts can take up to{' '}
              {WITHDRAWAL_HOURS} hours to confirm.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface/80 p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Plane className="h-4 w-4 -rotate-12" />
            Continue playing Aviator
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold">Ready for a real flight?</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-text">
            Add real funds with HarakaPay, then place an Aviator bet with your betting wallet.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/bet/deposit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background"
            >
              <Wallet className="h-4 w-4" />
              Deposit with HarakaPay
            </Link>
            <Link
              href="/bet/games/aviator"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
            >
              Place Aviator bet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-accent/25 bg-surface/80 p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Smartphone className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">Send prize to mobile money</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-text">
        Enter the Tanzanian mobile-money number that should receive your Aviator trial prize.
      </p>

      <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/10 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Prize amount</p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums">
          {formatTzs(trial.prizeMinor)}
        </p>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
          Mobile-money number
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          placeholder="07XX XXX XXX"
          disabled={phase === 'validating'}
          className="w-full rounded-xl border border-border bg-background/50 px-3 py-3 text-base font-semibold text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60 disabled:opacity-60"
        />
      </label>
      <p className="mt-2 text-[11px] text-muted-text">
        Use a Vodacom, Tigo, Airtel, Halotel, TTCL or Zantel number.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {phase === 'validating' ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5 text-xs font-semibold text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating your mobile-money number...
        </div>
      ) : null}

      <button
        type="submit"
        disabled={phase === 'validating'}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === 'validating' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {phase === 'validating' ? 'Checking number...' : `Withdraw ${formatTzs(trial.prizeMinor)}`}
      </button>
    </form>
  )
}
