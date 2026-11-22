'use client'

import { useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, Loader2, Save, SlidersHorizontal } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { MAX_STAKE_MINOR, MIN_STAKE_MINOR } from '@/lib/bet/types'

export function AdminMinStakeControl({ initialMinStakeMinor }: { initialMinStakeMinor: number }) {
  const [minStakeMinor, setMinStakeMinor] = useState(initialMinStakeMinor)
  const [minStakeInput, setMinStakeInput] = useState(String(initialMinStakeMinor))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const amountMinor = Math.round(Number(minStakeInput))
    if (
      !Number.isFinite(amountMinor) ||
      amountMinor < MIN_STAKE_MINOR ||
      amountMinor > MAX_STAKE_MINOR
    ) {
      setError(
        `Enter a minimum stake between ${formatTzs(MIN_STAKE_MINOR)} and ${formatTzs(MAX_STAKE_MINOR)}.`,
      )
      setSaved(false)
      return
    }

    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/admin/settings/min-stake', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        minStakeMinor?: number
        error?: string
      }
      if (!response.ok || typeof payload.minStakeMinor !== 'number') {
        setError(payload.error ?? 'Could not update the minimum stake.')
        return
      }
      setMinStakeMinor(payload.minStakeMinor)
      setMinStakeInput(String(payload.minStakeMinor))
      setSaved(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Minimum shared-slip stake · {formatTzs(minStakeMinor)}
          </span>
          <input
            type="number"
            min={MIN_STAKE_MINOR}
            max={MAX_STAKE_MINOR}
            step={100}
            inputMode="numeric"
            value={minStakeInput}
            onChange={event => {
              setMinStakeInput(event.target.value)
              setSaved(false)
              setError(null)
            }}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold tabular-nums text-main-text outline-none focus:border-amber-300/60"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3 py-2 text-xs font-bold text-amber-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save minimum'}
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-[11px] text-accent">
            <CircleCheck className="h-3.5 w-3.5" />
            Updated
          </span>
        ) : null}
        {error ? (
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : null}
      </form>
    </section>
  )
}
