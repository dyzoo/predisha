'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { CircleAlert, Loader2, ShieldCheck, UserPlus } from 'lucide-react'

interface SignupPayload {
  error?: string
  fields?: Record<string, string>
  redirectTo?: string
}

export function TrialSignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFields({})

    if (password !== confirm) {
      setFields({ confirm: 'The passwords do not match.' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/bet/trial/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, acceptedTerms }),
      })
      const payload = (await response.json().catch(() => ({}))) as SignupPayload

      if (!response.ok) {
        setError(payload.error ?? 'Account setup failed. Please try again.')
        setFields(payload.fields ?? {})
        return
      }

      window.location.assign(payload.redirectTo ?? '/bet/userAccount')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-surface/80 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        <UserPlus className="h-4 w-4" />
        Claim your prize
      </div>
      <h1 className="mt-2 font-display text-2xl font-semibold">Quick account setup</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-text">
        No email or phone verification. Create your account to move the Aviator trial prize into your
        wallet.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Full name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
          />
          {fields.name ? <span className="mt-1 block text-[11px] text-red-300">{fields.name}</span> : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
          />
          {fields.email ? (
            <span className="mt-1 block text-[11px] text-red-300">{fields.email}</span>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
            />
            {fields.password ? (
              <span className="mt-1 block text-[11px] text-red-300">{fields.password}</span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
              Confirm password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              placeholder="Repeat password"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none placeholder:text-muted-text/60 focus:border-accent/60"
            />
            {fields.confirm ? (
              <span className="mt-1 block text-[11px] text-red-300">{fields.confirm}</span>
            ) : null}
          </label>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-text">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={event => setAcceptedTerms(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
        />
        <span>
          I accept the{' '}
          <Link href="/terms" className="font-semibold text-accent hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {fields.acceptedTerms ? (
        <span className="mt-1 block text-[11px] text-red-300">{fields.acceptedTerms}</span>
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

      <button
        type="submit"
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? 'Creating account...' : 'Create account and claim prize'}
      </button>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-[11px] leading-relaxed text-muted-text">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        Your trial prize is credited to the betting wallet immediately after signup.
      </div>
    </form>
  )
}
