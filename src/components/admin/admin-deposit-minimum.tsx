'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, Wallet } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'

export function AdminDepositMinimum({ minDepositMinor }: { minDepositMinor: number }) {
  const router = useRouter()
  const [amount, setAmount] = useState(minDepositMinor)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/admin/deposit-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor: amount }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        minDepositMinor?: number
      }
      if (!response.ok) {
        setError(payload.error ?? 'Could not update the minimum deposit.')
        return
      }
      setAmount(payload.minDepositMinor ?? amount)
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
        <Wallet className="h-4 w-4 text-accent" />
        Minimum deposit
      </h2>
      <p className="mt-2 text-xs leading-relaxed">
        Set the smallest amount a user can deposit. The new limit applies to every account on both
        live and sandbox payments as soon as it is saved.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[180px] flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-text">
            Amount (TZS)
          </span>
          <input
            type="number"
            min={1}
            max={1_000_000}
            step={1}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
            className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm font-semibold tabular-nums outline-none focus:border-accent/60"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saving ? 'Saving' : 'Save minimum'}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-muted-text">
        Current limit for users: {formatTzs(minDepositMinor)}
      </p>
      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-accent">
          <CircleCheck className="h-3.5 w-3.5" />
          Minimum deposit updated to {formatTzs(amount)}.
        </p>
      ) : null}
    </section>
  )
}
