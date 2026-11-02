import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import type { Prisma, SubscriptionStatus } from '@prisma/client'
import { CircleCheck, Filter, Search, ShieldCheck, Users } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminNav } from '@/components/admin/admin-nav'
import { AdminUserActions } from '@/components/admin/admin-user-actions'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
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
      <PageShell eyebrow="Admin" title="Users">
        <AdminAccessState status="unconfigured" />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/users')
  if (!canViewAdmin(viewer)) {
    return (
      <PageShell eyebrow="Admin" title="Users">
        <AdminAccessState status="forbidden" />
      </PageShell>
    )
  }

  const { q, role } = await searchParams
  const query = (q ?? '').trim()
  const roleFilter = role === 'ADMIN' || role === 'USER' ? role : undefined

  const where: Prisma.UserWhereInput = {}
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (roleFilter) where.role = roleFilter

  const [users, total, admins, premium, unverified] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
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
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { subscription: { is: { status: { in: PREMIUM_STATUSES } } } } }),
    prisma.user.count({ where: { emailVerified: null } }),
  ])

  return (
    <PageShell
      eyebrow="Admin"
      title="Users"
      intro="Review accounts and adjust role or subscription access. Every change is written to the audit log."
    >
      <AdminNav active="/admin/users" />

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
                placeholder="e.g. premium@predisha.test"
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-main-text">
            {query || roleFilter ? 'Filtered accounts' : 'All accounts'}
          </h2>
          <p className="text-[11px] text-muted-text">
            Showing {users.length} of {total} accounts (max 50).
          </p>
        </div>

        {users.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center text-xs">
            No accounts match this filter.
          </p>
        ) : (
          users.map(user => {
            const subscriptionStatus = user.subscription?.status ?? null
            return (
              <article key={user.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-main-text">
                      {user.name ?? 'Unnamed account'}
                    </p>
                    <p className="truncate text-xs text-muted-text">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                      {user.role}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(subscriptionStatus)}`}
                    >
                      {subscriptionStatus ?? 'NO PLAN'}
                    </span>
                  </div>
                </div>

                <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <dt className="text-muted-text">Plan</dt>
                    <dd className="mt-0.5 font-semibold text-main-text">
                      {user.subscription
                        ? `${user.subscription.plan.name} · ${user.subscription.plan.interval.toLowerCase()}`
                        : 'None'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <dt className="text-muted-text">Period ends</dt>
                    <dd className="mt-0.5 font-semibold text-main-text">
                      {user.subscription?.currentPeriodEnd
                        ? `${user.subscription.currentPeriodEnd.toISOString().slice(0, 10)}${
                            user.subscription.cancelAtPeriodEnd ? ' (cancels)' : ''
                          }`
                        : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <dt className="text-muted-text">Email verified</dt>
                    <dd className="mt-0.5 font-semibold text-main-text">
                      {user.emailVerified ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <dt className="text-muted-text">Saved · slips</dt>
                    <dd className="mt-0.5 font-semibold text-main-text">
                      {user._count.savedFixtures} · {user._count.predictionSlips}
                    </dd>
                  </div>
                </dl>

                <AdminUserActions
                  userId={user.id}
                  role={user.role}
                  status={subscriptionStatus}
                  planId={user.subscription?.planId ?? null}
                  isSelf={user.id === viewer.userId}
                />
              </article>
            )
          })
        )}
      </section>
    </PageShell>
  )
}

export const instant = false
