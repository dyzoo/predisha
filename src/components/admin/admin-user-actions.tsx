'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, Loader2, Save, WalletCards } from 'lucide-react'
import { formatTzs } from '@/lib/bet/format'
import { MAX_DEPOSIT_MINOR } from '@/lib/bet/types'

const ROLES = ['USER', 'ADMIN'] as const
const STATUSES = ['INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'] as const
const PLANS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: '3 Months' },
] as const

type Role = (typeof ROLES)[number] | 'SUPER_ADMIN'
type Status = (typeof STATUSES)[number]

interface AdminUserActionsProps {
  userId: string
  role: Role
  status: Status | null
  planId: string | null
  walletBalanceMinor: number
  isSpecial: boolean
  isSelf: boolean
  canManageRoles: boolean
}

interface UpdateResponse {
  error?: string
}

interface FundResponse {
  error?: string
  wallet?: { balanceMinor: number }
}

export function AdminUserActions({
  userId,
  role,
  status,
  planId,
  walletBalanceMinor,
  isSpecial,
  isSelf,
  canManageRoles,
}: AdminUserActionsProps) {
  const router = useRouter()
  const [nextRole, setNextRole] = useState<Role>(role)
  const [nextStatus, setNextStatus] = useState<Status>(status ?? 'INACTIVE')
  const [nextPlan, setNextPlan] = useState<string>(
    PLANS.some(plan => plan.id === planId) ? planId! : 'monthly',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [funding, setFunding] = useState(false)
  const [fundError, setFundError] = useState<string | null>(null)
  const [funded, setFunded] = useState(false)
  const [updatedBalanceMinor, setUpdatedBalanceMinor] = useState<number | null>(null)
  const [nextSpecial, setNextSpecial] = useState(isSpecial)

  async function onFundWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (funding) return

    const amountMinor = Math.round(Number(fundAmount))
    if (!Number.isFinite(amountMinor) || amountMinor < 1 || amountMinor > MAX_DEPOSIT_MINOR) {
      setFundError(`Enter an amount between 1 and ${formatTzs(MAX_DEPOSIT_MINOR)}.`)
      return
    }

    setFunding(true)
    setFundError(null)
    setFunded(false)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/wallet`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor }),
      })
      const payload = (await response.json().catch(() => ({}))) as FundResponse
      if (!response.ok) {
        setFundError(payload.error ?? 'Could not add funds.')
        return
      }
      if (payload.wallet) setUpdatedBalanceMinor(payload.wallet.balanceMinor)
      setFundAmount('')
      setFunded(true)
      router.refresh()
    } catch {
      setFundError('Network error. Please try again.')
    } finally {
      setFunding(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    setSaved(false)

    const roleChange =
      canManageRoles && !isSelf && role !== 'SUPER_ADMIN' && nextRole !== role
        ? nextRole
        : undefined
    const specialChange = canManageRoles && nextSpecial !== isSpecial ? nextSpecial : undefined

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roleChange,
          subscriptionStatus: nextStatus,
          planId: nextStatus === 'INACTIVE' ? undefined : nextPlan,
          isSpecial: specialChange,
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
    <div className="mt-3 space-y-3">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Role</span>
          <select
            value={nextRole}
            onChange={event => {
              setNextRole(event.target.value as Role)
              setSaved(false)
            }}
            disabled={isSelf || pending || !canManageRoles || role === 'SUPER_ADMIN'}
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {role === 'SUPER_ADMIN' ? <option value="SUPER_ADMIN">SUPER ADMIN</option> : null}
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

      <label className="flex items-start gap-2.5 rounded-xl border border-amber-300/25 bg-amber-300/5 p-2.5">
        <input
          type="checkbox"
          checked={nextSpecial}
          onChange={event => {
            setNextSpecial(event.target.checked)
            setSaved(false)
          }}
          disabled={pending || !canManageRoles}
          className="mt-0.5 h-4 w-4 shrink-0 accent-amber-300 disabled:opacity-60"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
            <CircleCheck className="h-3.5 w-3.5" />
            Special user
          </span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-text">
            Special users can edit shared slips after matches finish and self-assign winners from
            paid entries. Every change is audited.
          </span>
        </span>
      </label>

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
        ) : role === 'SUPER_ADMIN' ? (
          <span className="text-[11px] text-muted-text">
            Super admin access cannot be changed from this panel.
          </span>
        ) : !canManageRoles ? (
          <span className="text-[11px] text-muted-text">
            Only a super admin can change roles or special bet tools.
          </span>
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

      <form
        onSubmit={onFundWallet}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background/40 p-3"
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
            Wallet balance {formatTzs(updatedBalanceMinor ?? walletBalanceMinor)}
          </span>
          <input
            type="number"
            min="1"
            max={MAX_DEPOSIT_MINOR}
            step="1"
            inputMode="numeric"
            value={fundAmount}
            onChange={event => {
              setFundAmount(event.target.value)
              setFunded(false)
              setFundError(null)
            }}
            placeholder="Amount in TZS"
            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
          />
        </label>
        <button
          type="submit"
          disabled={funding}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {funding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <WalletCards className="h-3.5 w-3.5" />
          )}
          {funding ? 'Adding…' : 'Add funds'}
        </button>
        {funded ? (
          <span className="flex items-center gap-1.5 text-[11px] text-accent">
            <CircleCheck className="h-3.5 w-3.5" />
            Funds added
          </span>
        ) : null}
        {fundError ? (
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5" />
            {fundError}
          </span>
        ) : null}
      </form>

    </div>
  )
}
