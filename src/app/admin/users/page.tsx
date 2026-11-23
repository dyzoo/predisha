import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import type { Prisma, SubscriptionStatus } from '@prisma/client'
import { CircleCheck, Filter, Search, ShieldCheck, Users } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminCreateAdmin } from '@/components/admin/admin-create-admin'
import { AdminMinStakeControl } from '@/components/admin/admin-min-stake-control'
import { AdminNav } from '@/components/admin/admin-nav'
import { AdminSendSmsForm } from '@/components/admin/admin-send-sms-form'
import { AdminUserActions } from '@/components/admin/admin-user-actions'
import { canViewAdmin, isSuperAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { maskTzPhone } from '@/lib/bet/phone'
import { formatTzs } from '@/lib/bet/format'
import { getMinStakeMinor } from '@/lib/bet/stake-settings'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Admin users',
}

const PREMIUM_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

function statusClass(status: string | null | undefined): string {
  if (status === 'ACTIVE' || status === 'TRIALING') {
    return 'border-accent/30 bg-accent/10 text-accent'
  }
  if (status === 'PAST_DUE' || status === 'UNPAID') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  }
  if (status === 'CANCELED') {
    return 'border-red-400/30 bg-red-400/10 text-red-200'
  }
  return 'border-border bg-background/40 text-muted-text'
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <AdminShell eyebrow="Admin" title="Users">
        <AdminAccessState status="unconfigured" />
      </AdminShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/users')
  if (!canViewAdmin(viewer)) {
    return (
      <AdminShell eyebrow="Admin" title="Users">
        <AdminAccessState status="forbidden" />
      </AdminShell>
    )
  }

  const { q, role } = await searchParams
  const query = (q ?? '').trim()
  const roleFilter =
    role === 'ADMIN' || role === 'USER' || role === 'SUPER_ADMIN' ? role : undefined
  const superAdmin = isSuperAdmin(viewer)

  const where: Prisma.UserWhereInput = {}
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (roleFilter) where.role = roleFilter

  const [users, total, admins, premium, unverified, minStakeMinor] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isSpecial: true,
        emailVerified: true,
        createdAt: true,
        betWallet: { select: { balanceMinor: true } },
        subscription: {
          select: {
            status: true,
            planId: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
            plan: { select: { name: true, interval: true } },
          },
        },
        _count: { select: { savedFixtures: true, predictionSlips: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.user.count({ where: { subscription: { is: { status: { in: PREMIUM_STATUSES } } } } }),
    prisma.user.count({ where: { emailVerified: null } }),
    getMinStakeMinor(),
  ])

  return (
    <AdminShell
      eyebrow="Admin"
      title="Users"
      intro="Compact account controls for roles, subscriptions, wallets, special bet tools and the shared-slip minimum stake. Every change is audited."
    >
      <AdminNav active="/admin/users" />

      {superAdmin ? <AdminCreateAdmin /> : null}

      <AdminSendSmsForm
        users={users
          .filter(user => Boolean(user.phone))
          .map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone as string,
          }))}
      />

      <AdminMinStakeControl initialMinStakeMinor={minStakeMinor} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Users', value: total, icon: Users },
          { label: 'Admins', value: admins, icon: ShieldCheck },
          { label: 'Premium', value: premium, icon: CircleCheck },
          { label: 'Unverified', value: unverified, icon: CircleCheck },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-border bg-surface/60 p-3">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-text">
                <Icon className="h-3 w-3 text-accent" />
                {item.label}
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-main-text">
                {item.value}
              </p>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
              Search by email or name
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="e.g. premium@spotibet.test"
                className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
              />
            </div>
          </label>
          <label className="w-32">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Role</span>
            <select
              name="role"
              defaultValue={roleFilter ?? ''}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
            >
              <option value="">All roles</option>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
          <Link
            href="/admin/users"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-text transition-colors hover:text-main-text"
          >
            Reset
          </Link>
        </form>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-main-text">
            {query || roleFilter ? 'Filtered accounts' : 'All accounts'}
          </h2>
          <p className="text-[11px] text-muted-text">
            Showing {users.length} of {total} accounts (max 50). Inline controls save immediately.
          </p>
        </div>

        {users.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center text-xs">
            No accounts match this filter.
          </p>
        ) : (
          users.map(user => {
            const subscriptionStatus = user.subscription?.status ?? null
            const initials = (user.name ?? user.email)
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map(part => part[0]?.toUpperCase() ?? '')
              .join('')
            return (
              <article
                key={user.id}
                className="rounded-xl border border-border bg-surface/60 p-3 transition-colors hover:border-accent/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-xs font-bold text-accent">
                      {initials || '?'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-main-text">
                          {user.name ?? 'Unnamed account'}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            user.role === 'SUPER_ADMIN'
                              ? 'border-violet-300/35 bg-violet-300/10 text-violet-200'
                              : 'border-border bg-background/40 text-muted-text'
                          }`}
                        >
                          {user.role}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(subscriptionStatus)}`}
                        >
                          {subscriptionStatus ?? 'NO PLAN'}
                        </span>
                        {user.isSpecial ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            <CircleCheck className="h-3 w-3" />
                            Special
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-text">
                        {user.email}
                        {user.phone ? ` · ${maskTzPhone(user.phone)}` : null}
                      </p>
                    </div>
                  </div>
                  <dl className="flex flex-wrap items-center gap-2 text-[10px]">
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-center">
                      <dt className="text-muted-text">Wallet</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-main-text">
                        {formatTzs(user.betWallet?.balanceMinor ?? 0)}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-center">
                      <dt className="text-muted-text">Plan</dt>
                      <dd className="mt-0.5 font-semibold text-main-text">
                        {user.subscription?.plan.name ?? 'None'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-center">
                      <dt className="text-muted-text">Verified</dt>
                      <dd className="mt-0.5 font-semibold text-main-text">
                        {user.emailVerified ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-center">
                      <dt className="text-muted-text">Joined</dt>
                      <dd className="mt-0.5 font-semibold text-main-text">
                        {user.createdAt.toISOString().slice(0, 10)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <AdminUserActions
                  userId={user.id}
                  role={user.role}
                  status={subscriptionStatus}
                  planId={user.subscription?.planId ?? null}
                  walletBalanceMinor={user.betWallet?.balanceMinor ?? 0}
                  isSpecial={user.isSpecial}
                  isSelf={user.id === viewer.userId}
                  canManageRoles={superAdmin}
                />
              </article>
            )
          })
        )}
      </section>
    </AdminShell>
  )
}

export const instant = false
