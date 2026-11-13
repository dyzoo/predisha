'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, Power } from 'lucide-react'

type BetMode = 'LIVE' | 'SANDBOX'

const OPTIONS: { value: BetMode; label: string; hint: string }[] = [
  { value: 'LIVE', label: 'Live', hint: 'Real payments through HarakaPay' },
  { value: 'SANDBOX', label: 'Sandbox', hint: 'Play money for testing' },
]

export function AdminBetModeToggle({ mode }: { mode: BetMode }) {
  const router = useRouter()
  const [current, setCurrent] = useState<BetMode>(mode)
  const [pending, setPending] = useState<BetMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function change(next: BetMode) {
    if (pending || next === current) return
    setPending(next)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/admin/bet-mode', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        mode?: BetMode
      }
      if (!response.ok) {
        setError(payload.error ?? 'Could not change the betting mode.')
        return
      }
      setCurrent(payload.mode ?? next)
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
        <Power className="h-4 w-4 text-accent" />
        Betting mode
      </h2>
      <p className="mt-2 text-xs leading-relaxed">
        Live mode collects real payments through HarakaPay before a bet is placed. Sandbox mode
        keeps everything on play money so you can test the full flow without charging customers.
        Every page adapts its wording to the active mode.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map(option => {
          const active = option.value === current
          const busy = pending === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => change(option.value)}
              disabled={pending !== null}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                active
                  ? 'border-accent/50 bg-accent/10'
                  : 'border-border bg-background/40 hover:border-accent/30'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                  active ? 'border-accent bg-accent' : 'border-muted-text/50'
                }`}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin text-background" />
                ) : active ? (
                  <CircleCheck className="h-3 w-3 text-background" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-main-text">
                  {option.label}
                  {active ? (
                    <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Active
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-text">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-accent">
          <CircleCheck className="h-3.5 w-3.5" />
          Betting mode updated.
        </p>
      ) : null}
    </section>
  )
}