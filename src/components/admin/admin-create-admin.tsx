'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, ShieldPlus, UserPlus } from 'lucide-react'

interface PromoteResponse {
  error?: string
  data?: { email: string; name: string | null }
}

export function AdminCreateAdmin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    setCreatedEmail(null)

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const payload = (await response.json().catch(() => ({}))) as PromoteResponse
      if (!response.ok || !payload.data) {
        setError(payload.error ?? 'Could not create this admin.')
        return
      }
      setCreatedEmail(payload.data.email)
      setEmail('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-violet-300/25 bg-violet-300/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/15 text-violet-200">
          <ShieldPlus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-main-text">Create another admin</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-text">
            Promote an existing registered account to admin. The new admin can manage users,
            winner payouts, slips and platform settings, but only super admins can change roles.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
            Registered account email
          </span>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-violet-300/60">
            <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-text" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={event => {
                setEmail(event.target.value)
                setError(null)
                setCreatedEmail(null)
              }}
              placeholder="new-admin@example.com"
              className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldPlus className="h-3.5 w-3.5" />}
          {pending ? 'Creating admin...' : 'Make admin'}
        </button>
      </form>

      {createdEmail ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-accent">
          <CircleCheck className="h-3.5 w-3.5" />
          {createdEmail} now has admin access.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </section>
  )
}
