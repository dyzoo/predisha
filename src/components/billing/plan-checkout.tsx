'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, Smartphone } from 'lucide-react'
import type { PublicPlan } from '@/lib/billing/plans'

interface PlanCheckoutProps {
  plans: PublicPlan[]
  provider: string
}

interface CheckoutResult {
  provider: string
  orderId: string | null
  status: string | null
  amountMinor: number | null
  currency: string | null
  message: string
}

type Confirmation = 'idle' | 'waiting' | 'active' | 'failed'

const SUCCESS_STATUSES = ['completed', 'success', 'succeeded', 'paid', 'confirmed']
const FAILURE_STATUSES = ['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'expired']

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

export function PlanCheckout({ plans, provider }: PlanCheckoutProps) {
  const router = useRouter()
  const isHarakaPay = provider === 'harakapay'
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>('idle')
  const attemptsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const plan = plans.find(item => item.id === planId) ?? plans[0]

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function confirmOrder(orderId: string) {
    attemptsRef.current += 1
    try {
      const response = await fetch('/api/billing/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { status?: string; eventStatus?: string | null }
      }

      if (response.ok) {
        const eventStatus = (payload.data?.eventStatus ?? '').toLowerCase()
        const subscriptionStatus = (payload.data?.status ?? '').toUpperCase()

        if (FAILURE_STATUSES.includes(eventStatus)) {
          setConfirmation('failed')
          setError('The payment was not completed. No premium access was granted.')
          return
        }

        if (subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING') {
          setConfirmation('active')
          router.refresh()
          return
        }

        if (SUCCESS_STATUSES.includes(eventStatus)) {
          setConfirmation('failed')
          setError('The payment was confirmed but the subscription could not be activated. Contact support.')
          return
        }
      }
    } catch {
      // Transient network errors are retried below.
    }

    if (attemptsRef.current >= 60) {
      setConfirmation('idle')
      setError('Payment is still pending. Refresh this page after approving the USSD prompt.')
      return
    }

    timerRef.current = setTimeout(() => confirmOrder(orderId), 5000)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!plan || pending) return

    setError(null)
    setPending(true)
    setConfirmation('idle')
    try {
      const body = isHarakaPay ? { planId: plan.id, phone } : { planId: plan.id }
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        data?: CheckoutResult
      }
      if (!response.ok) {
        setError(payload.error ?? 'Unable to start checkout.')
        return
      }

      const data = payload.data ?? null
      setResult(data)

      if (isHarakaPay && data?.orderId) {
        const orderId = data.orderId
        setConfirmation('waiting')
        attemptsRef.current = 0
        timerRef.current = setTimeout(() => confirmOrder(orderId), 3000)
      } else if (data?.status === 'active') {
        setConfirmation('active')
        router.refresh()
      }
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

      {confirmation === 'active' ? (
        <div role="status" className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent">
            <CircleCheck className="h-4 w-4" />
            Subscription active
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-text">
            Premium is now unlocked on this account. You can close this page and keep building slips.
          </p>
        </div>
      ) : null}

      {confirmation === 'waiting' ? (
        <div role="status" className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for payment confirmation
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-text">
            {result?.message} to the number ending in {phone.slice(-4)}. Approve the USSD prompt on your
            handset. This page updates automatically once HarakaPay confirms the payment.
          </p>
          {result?.orderId ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-text">
              Order {result.orderId}
            </p>
          ) : null}
        </div>
      ) : null}

      {isHarakaPay && confirmation === 'idle' && result?.orderId ? (
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-main-text">
            <Smartphone className="h-4 w-4" />
            USSD push sent
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-2.5">
              <dt className="text-muted-text">Order</dt>
              <dd className="mt-0.5 font-semibold text-main-text">{result.orderId}</dd>
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
        </div>
      ) : null}

      {!isHarakaPay ? (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Test billing is enabled. This activates premium immediately without taking a real payment.
            Switch <code>BILLING_PROVIDER</code> to <code>harakapay</code> to charge for real.
          </p>
        </div>
      ) : null}

      <div className={`grid gap-3 ${isHarakaPay ? 'sm:grid-cols-2' : ''}`}>
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
              setConfirmation('idle')
            }}
            disabled={pending}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus-within:border-accent/60 disabled:cursor-not-allowed"
          >
            {plans.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} - {formatAmount(item.amountMinor, item.currency)}
              </option>
            ))}
          </select>
        </div>
        {isHarakaPay ? (
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
                setConfirmation('idle')
              }}
              disabled={pending}
              placeholder="0712345678"
              aria-label="Mobile number for the USSD push"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus-within:border-accent/60 disabled:cursor-not-allowed"
            />
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={!plan || pending}
        aria-busy={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-background/60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending
          ? 'Starting checkout...'
          : isHarakaPay
            ? 'Start HarakaPay payment'
            : 'Activate test subscription'}
      </button>
      {plan ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-text">
          {formatAmount(plan.amountMinor, plan.currency)} per {plan.interval.toLowerCase()}.
          {isHarakaPay ? ' The provider fee is applied by HarakaPay.' : ''}
        </p>
      ) : null}
    </form>
  )
}
