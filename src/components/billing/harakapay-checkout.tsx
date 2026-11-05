'use client'

import { useState, type FormEvent } from 'react'
import { CircleAlert, Loader2, Smartphone } from 'lucide-react'
import type { PublicPlan } from '@/lib/billing/plans'

interface HarakaPayCheckoutProps {
  plans: PublicPlan[]
}

interface CheckoutResult {
  orderId: string | null
  status: string | null
  amountMinor: number | null
  currency: string | null
  message: string
}

function formatAmount(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return 'Not available'
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100)
  } catch {
    return `${amountMinor / 100} ${currency}`
  }
}

export function HarakaPayCheckout({ plans }: HarakaPayCheckoutProps) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)

  const plan = plans.find(item => item.id === planId) ?? plans[0]

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!plan || pending) return

    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, phone }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        data?: CheckoutResult
      }
      if (!response.ok) {
        setError(payload.error ?? 'Unable to start the HarakaPay checkout.')
        return
      }
      setResult(payload.data ?? null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (plans.length === 0) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-muted-text">
        No subscription plans are available for checkout right now.
      </p>
    )
  }

  return (
    <form
      className="mt-4 rounded-xl border border-border bg-background/40 p-4"
      onSubmit={onSubmit}
      noValidate
    >
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-xs leading-relaxed text-red-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Smartphone className="h-4 w-4" />
            USSD push sent
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-text">
            {result.message} to the number ending in {phone.slice(-4)}. Approve the payment on your
            handset, then wait for the confirmation from HarakaPay.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-2.5">
              <dt className="text-muted-text">Order</dt>
              <dd className="mt-0.5 font-semibold text-main-text">{result.orderId ?? 'Pending'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-2.5">
              <dt className="text-muted-text">Status</dt>
              <dd className="mt-0.5 font-semibold text-main-text">{result.status ?? 'pending'}</dd>
            </div>
            {result.amountMinor !== null ? (
              <div className="rounded-lg border border-border bg-background/40 p-2.5">
                <dt className="text-muted-text">Amount</dt>
                <dd className="mt-0.5 font-semibold text-main-text">
                  {formatAmount(result.amountMinor, result.currency ?? 'USD')}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-text">
            Your premium access unlocks after HarakaPay confirms the payment. No card details are
            collected or stored by Predisha.
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="billing-plan"
            className="mb-1.5 block text-xs font-medium text-muted-text"
          >
            Plan
          </label>
          <select
            id="billing-plan"
            value={plan?.id ?? ''}
            onChange={event => {
              setPlanId(event.target.value)
              setResult(null)
            }}
            disabled={pending}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus-within:border-accent/60 disabled:cursor-not-allowed"
          >
            {plans.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatAmount(item.amountMinor, item.currency)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="billing-phone"
            className="mb-1.5 block text-xs font-medium text-muted-text"
          >
            Mobile number
          </label>
          <input
            id="billing-phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            required
            minLength={7}
            maxLength={15}
            value={phone}
            onChange={event => {
              setPhone(event.target.value)
              setResult(null)
            }}
            disabled={pending}
            placeholder="0712345678"
            aria-label="Mobile number for the USSD push"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus-within:border-accent/60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!plan || pending}
        aria-busy={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-background/60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Sending USSD push…' : 'Start HarakaPay payment'}
      </button>
      {plan ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-text">
          {formatAmount(plan.amountMinor, plan.currency)} per {plan.interval.toLowerCase()}. The
          provider fee is applied by HarakaPay.
        </p>
      ) : null}
    </form>
  )
}
