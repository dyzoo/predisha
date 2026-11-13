'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  Loader2,
  Plane,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react'
import type { AviatorConfig } from '@/lib/bet/aviator-config'
import { formatMultiplier, formatTzs } from '@/lib/bet/format'

interface AviatorStats {
  activeBets: number
  lifetimeBets: number
  lifetimeStakeMinor: number
  lifetimePayoutMinor: number
  lastDayBets: number
  lastDayStakeMinor: number
  lastDayPayoutMinor: number
}

interface AdminAviatorSettingsProps {
  initialConfig: AviatorConfig
  defaults: AviatorConfig
  stats: AviatorStats
  history: Array<{ roundId: string; crashAt: number }>
}

interface FormState {
  enabled: boolean
  waitSeconds: number
  roundSeconds: number
  growth: number
  maxCrash: number
  houseEdge: number
}

function toForm(config: AviatorConfig): FormState {
  return {
    enabled: config.enabled,
    waitSeconds: Math.round(config.waitMs / 1000),
    roundSeconds: Math.round(config.roundMs / 1000),
    growth: config.growth,
    maxCrash: config.maxCrash,
    houseEdge: config.houseEdge,
  }
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium text-muted-text">{label}</span>
      <span className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-3 focus-within:border-accent/60">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          className="w-full bg-transparent py-2.5 text-sm font-semibold tabular-nums outline-none"
        />
        <span className="text-[11px] font-semibold text-muted-text">{suffix}</span>
      </span>
      <span className="mt-1 block text-[10px] leading-relaxed text-muted-text">{hint}</span>
    </label>
  )
}

export function AdminAviatorSettings({
  initialConfig,
  defaults,
  stats,
  history,
}: AdminAviatorSettingsProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => toForm(initialConfig))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const longestFlightSeconds = form.growth > 0 ? Math.log(form.maxCrash) / form.growth : 0
  const fitsCycle = form.waitSeconds + longestFlightSeconds <= form.roundSeconds
  const expectedRoundStart = form.waitSeconds

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/aviator', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        config?: AviatorConfig
        error?: string
      }
      if (!response.ok || !payload.config) {
        setError(payload.error ?? 'Could not save the Aviator settings.')
        return
      }
      setForm(toForm(payload.config))
      setSuccess('Aviator settings saved. The next round uses the new cycle.')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent"
        >
          <CircleCheck className="h-4 w-4 shrink-0" />
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
                <Plane className="h-4 w-4 text-accent" />
                Round engine
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-text">
                These values are read by the server on every round. Changing the round length
                starts a new cycle and may settle bets that belong to the old cycle.
              </p>
            </div>
            <Link
              href="/bet/games/aviator"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-main-text transition-colors hover:border-accent/40"
            >
              Open game
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-main-text">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Betting enabled
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-text">
                When disabled, players see a paused state and new bets are rejected.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => setForm(current => ({ ...current, enabled: !current.enabled }))}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                form.enabled
                  ? 'border-accent/50 bg-accent/30'
                  : 'border-border bg-background'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform ${
                  form.enabled ? 'translate-x-5 bg-accent' : 'translate-x-0 bg-muted-text'
                }`}
              />
            </button>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField
              id="aviator-wait"
              label="Betting window"
              hint="Time before the plane takes off."
              value={form.waitSeconds}
              min={2}
              max={30}
              step={1}
              suffix="sec"
              onChange={value => setForm(current => ({ ...current, waitSeconds: value }))}
            />
            <NumberField
              id="aviator-round"
              label="Round length"
              hint="Total cycle length, including the flight."
              value={form.roundSeconds}
              min={10}
              max={300}
              step={1}
              suffix="sec"
              onChange={value => setForm(current => ({ ...current, roundSeconds: value }))}
            />
            <NumberField
              id="aviator-growth"
              label="Growth speed"
              hint="Higher values make the multiplier climb faster."
              value={form.growth}
              min={0.05}
              max={0.5}
              step={0.01}
              suffix="x/s"
              onChange={value => setForm(current => ({ ...current, growth: value }))}
            />
            <NumberField
              id="aviator-max"
              label="Maximum crash"
              hint="Hard ceiling for every generated crash point."
              value={form.maxCrash}
              min={1.1}
              max={500}
              step={0.1}
              suffix="x"
              onChange={value => setForm(current => ({ ...current, maxCrash: value }))}
            />
            <NumberField
              id="aviator-edge"
              label="House edge"
              hint="0.05 means a 5% house edge. Lower pays players more often."
              value={form.houseEdge}
              min={0}
              max={0.25}
              step={0.01}
              suffix="rate"
              onChange={value => setForm(current => ({ ...current, houseEdge: value }))}
            />
            <div className="rounded-xl border border-border bg-background/40 p-3 text-[11px] leading-relaxed">
              <p className="font-semibold text-main-text">Cycle preview</p>
              <p className="mt-1 text-muted-text">
                Flight starts {expectedRoundStart}s in. Longest flight ≈{' '}
                {longestFlightSeconds.toFixed(1)}s.
              </p>
              <p className={`mt-1 font-semibold ${fitsCycle ? 'text-accent' : 'text-red-300'}`}>
                {fitsCycle
                  ? 'Fits inside the round.'
                  : 'Too long for this round. Lower the crash ceiling or raise the round length.'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !fitsCycle}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save settings
            </button>
            <button
              type="button"
              onClick={() => setForm(toForm(defaults))}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:border-accent/40 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Reset defaults
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-base font-bold text-main-text">Live activity</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Active bets', value: String(stats.activeBets) },
                { label: 'Bets today', value: String(stats.lastDayBets) },
                { label: 'Staked today', value: formatTzs(stats.lastDayStakeMinor) },
                { label: 'Paid today', value: formatTzs(stats.lastDayPayoutMinor) },
                { label: 'Lifetime bets', value: String(stats.lifetimeBets) },
                { label: 'Lifetime paid', value: formatTzs(stats.lifetimePayoutMinor) },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <dt className="text-muted-text">{item.label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-main-text">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-base font-bold text-main-text">Recent crash points</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {history.map(item => (
                <span
                  key={item.roundId}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                    item.crashAt >= 2
                      ? 'bg-accent/15 text-accent'
                      : 'bg-red-400/15 text-red-300'
                  }`}
                >
                  {formatMultiplier(item.crashAt)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-text">
              Crash points are derived from the deterministic round seed and the current house
              edge and ceiling. They update when this configuration changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
