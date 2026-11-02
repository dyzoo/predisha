'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, Save } from 'lucide-react'

const ROLES = ['USER', 'ADMIN'] as const
const STATUSES = ['INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'] as const
const PLANS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
] as const

type Role = (typeof ROLES)[number]
type Status = (typeof STATUSES)[number]

interface AdminUserActionsProps {
  userId: string
  role: Role
  status: Status | null
  planId: string | null
  isSelf: boolean
}

interface UpdateResponse {
  error?: string
}

export function AdminUserActions({ userId, role, status, planId, isSelf }: AdminUserActionsProps) {
  const router = useRouter()
  const [nextRole, setNextRole] = useState<Role>(role)
  const [nextStatus, setNextStatus] = useState<Status>(status ?? 'INACTIVE')
  const [nextPlan, setNextPlan] = useState<string>(
    planId === 'weekly' || planId === 'monthly' ? planId : 'monthly',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    setSaved(false)

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: nextRole,
          subscriptionStatus: nextStatus,
          planId: nextStatus === 'INACTIVE' ? undefined : nextPlan,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as UpdateResponse
      if (!response.ok) {
        setError(payload.error ?? 'Could not update this user.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Role</span>
          <select
            value={nextRole}
            onChange={event => {
              setNextRole(event.target.value as Role)
              setSaved(false)
            }}
            disabled={isSelf || pending}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ROLES.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Subscription</span>
          <select
            value={nextStatus}
            onChange={event => {
              setNextStatus(event.target.value as Status)
              setSaved(false)
            }}
            disabled={pending}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {STATUSES.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Plan</span>
          <select
            value={nextPlan}
            onChange={event => {
              setNextPlan(event.target.value)
              setSaved(false)
            }}
            disabled={nextStatus === 'INACTIVE' || pending}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {PLANS.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? 'Saving…' : 'Save access'}
        </button>
        {isSelf ? (
          <span className="text-[11px] text-muted-text">You cannot change your own role.</span>
        ) : null}
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
      </div>
    </form>
  )
}
