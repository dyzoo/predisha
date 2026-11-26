import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Filter, Receipt, Search } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminAccessState } from '@/components/admin/admin-access-state'
import { AdminNav } from '@/components/admin/admin-nav'
import {
  buildPaymentActivity,
  readJsonNumber,
  readJsonRecord,
  readJsonString,
  type PaymentActivityInput,
  type PaymentActivityStatus,
} from '@/lib/admin/payment-activity'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { SETTLO_PROVIDER_NAME } from '@/lib/billing/settlopay'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Admin payments',
}

interface ClientUser {
  name: string | null
  email: string
  phone?: string | null
}

function clientLabel(user: ClientUser | null | undefined): string | null {
  if (!user) return null
  return [user.name, user.email].filter(Boolean).join(' · ') || null
}

function statusTone(status: PaymentActivityStatus): string {
  if (status === 'PAID') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  }
  if (status === 'FAILED') {
    return 'border-red-400/30 bg-red-400/10 text-red-200'
  }
  if (status === 'PENDING') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  }
  return 'border-border bg-background/40 text-muted-text'
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; status?: string }>
}) {
  await connection()

  if (!isAuthConfigured()) {
    return (
      <AdminShell eyebrow="Admin" title="Payments">
        <AdminAccessState status="unconfigured" />
      </AdminShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin/payments')

  if (!canViewAdmin(viewer)) {
    return (
      <AdminShell eyebrow="Admin" title="Payments">
        <AdminAccessState status="forbidden" />
      </AdminShell>
    )
  }

  const filters = await searchParams
  const query = (typeof filters.q === 'string' ? filters.q : '').trim().slice(0, 120)
  const kind =
    filters.kind === 'deposit' ||
    filters.kind === 'slip' ||
    filters.kind === 'subscription'
      ? filters.kind
      : 'all'
  const status =
    filters.status === 'paid' || filters.status === 'pending' || filters.status === 'failed'
      ? filters.status
      : 'all'

  const [orders, transactions, slips, billingEvents] = await Promise.all([
    prisma.betPaymentOrder.findMany({
      where: {
        OR: query
          ? [
              { user: { is: { phone: { contains: query, mode: 'insensitive' } } } },
              { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: query, mode: 'insensitive' } } } },
              { phone: { contains: query, mode: 'insensitive' } },
              { orderId: { contains: query, mode: 'insensitive' } },
              { provider: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        kind: true,
        amountMinor: true,
        currency: true,
        provider: true,
        phone: true,
        orderId: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    }),
    prisma.betTransaction.findMany({
      where: {
        type: 'DEPOSIT',
        OR: query
          ? [
              { user: { is: { phone: { contains: query, mode: 'insensitive' } } } },
              { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: query, mode: 'insensitive' } } } },
              { reference: { contains: query, mode: 'insensitive' } },
              { note: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        amountMinor: true,
        reference: true,
        note: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    }),
    prisma.adminBetEntry.findMany({
      where: {
        OR: query
          ? [
              { phone: { contains: query, mode: 'insensitive' } },
              { provider: { contains: query, mode: 'insensitive' } },
              { providerOrderId: { contains: query, mode: 'insensitive' } },
              { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: query, mode: 'insensitive' } } } },
              { slip: { is: { code: { contains: query, mode: 'insensitive' } } } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        phone: true,
        stakeMinor: true,
        provider: true,
        providerOrderId: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        slip: { select: { code: true } },
      },
    }),
    prisma.billingEvent.findMany({
      where: {
        OR: query
          ? [
              { providerEventId: { contains: query, mode: 'insensitive' } },
              { processingState: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        providerEventId: true,
        processingState: true,
        safeMetadata: true,
        createdAt: true,
        subscription: {
          select: { user: { select: { name: true, email: true, phone: true } } },
        },
      },
    }),
  ])

  const billingUserIds = [
    ...new Set(
      billingEvents
        .map(event => readJsonString(readJsonRecord(event.safeMetadata).userId))
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const billingUsers = billingUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: billingUserIds } },
        select: { id: true, name: true, email: true, phone: true },
      })
    : []
  const billingUsersById = new Map(billingUsers.map(user => [user.id, user]))

  const rows: PaymentActivityInput[] = []

  if (kind === 'all' || kind === 'deposit') {
    for (const order of orders) {
      rows.push({
        id: order.id,
        kind: 'DEPOSIT',
        client: clientLabel(order.user),
        phone: order.phone ?? order.user.phone ?? null,
        amountMinor: order.amountMinor,
        currency: order.currency,
        provider: order.provider,
        reference: order.orderId,
        status: order.status,
        createdAt: order.createdAt,
      })
    }
  }

  if (kind === 'all' || kind === 'deposit') {
    for (const transaction of transactions) {
      const metadata = readJsonRecord(transaction.metadata)
      if (metadata.provider === SETTLO_PROVIDER_NAME) continue
      if (transaction.reference?.startsWith('settlopay:')) continue
      rows.push({
        id: transaction.id,
        kind: 'DEPOSIT',
        client: clientLabel(transaction.user),
        phone: transaction.user.phone ?? readJsonString(metadata.phone),
        amountMinor: transaction.amountMinor,
        currency: 'TZS',
        provider: readJsonString(metadata.provider) ?? 'manual',
        reference: transaction.reference ?? transaction.note ?? transaction.id,
        status: readJsonString(metadata.status) ?? 'PAID',
        createdAt: transaction.createdAt,
      })
    }
  }

  if (kind === 'all' || kind === 'slip') {
    for (const entry of slips) {
      rows.push({
        id: entry.id,
        kind: 'SHARED_SLIP',
        client: clientLabel(entry.user),
        phone: entry.phone,
        amountMinor: entry.stakeMinor,
        currency: 'TZS',
        provider: entry.provider,
        reference: entry.providerOrderId ?? entry.slip.code,
        status: entry.status,
        createdAt: entry.createdAt,
      })
    }
  }

  if (kind === 'all' || kind === 'subscription') {
    for (const event of billingEvents) {
      const metadata = readJsonRecord(event.safeMetadata)
      const user =
        event.subscription?.user ??
        billingUsersById.get(readJsonString(metadata.userId) ?? '') ??
        null
      rows.push({
        id: event.id,
        kind: 'SUBSCRIPTION',
        client: clientLabel(user),
        phone: readJsonString(metadata.phone) ?? user?.phone ?? null,
        amountMinor: readJsonNumber(metadata.amountMinor),
        currency: readJsonString(metadata.currency) ?? 'TZS',
        provider: readJsonString(metadata.provider) ?? SETTLO_PROVIDER_NAME,
        reference: event.providerEventId,
        status: readJsonString(metadata.status) ?? event.processingState,
        createdAt: event.createdAt,
      })
    }
  }

  let activity = buildPaymentActivity(rows)
  if (status !== 'all') {
    activity = activity.filter(item => item.status.toLowerCase() === status)
  }
  if (query) {
    const needle = query.toLowerCase()
    activity = activity.filter(item =>
      [item.phone, item.client, item.reference, item.provider, item.kindLabel].some(value =>
        value.toLowerCase().includes(needle),
      ),
    )
  }
  activity = activity.slice(0, 200)

  const paidCount = activity.filter(item => item.status === 'PAID').length
  const pendingCount = activity.filter(item => item.status === 'PENDING').length

  return (
    <AdminShell
      eyebrow="Admin"
      title="Payments"
      intro="Payment activity across wallet deposits, shared slips and subscriptions. Client phone numbers are shown in full for reconciliation."
    >
      <AdminNav active="/admin/payments" />

      <section className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: 'Activities', value: activity.length },
            { label: 'Paid', value: paidCount },
            { label: 'Pending', value: pendingCount },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-center"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-text">
                {stat.label}
              </p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-main-text">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
              Phone, client or payment reference
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="e.g. 0712345678 or pi_…"
                className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/70"
              />
            </div>
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Type</span>
            <select
              name="kind"
              defaultValue={kind}
              className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
            >
              <option value="all">All payments</option>
              <option value="deposit">Wallet deposits</option>
              <option value="slip">Shared slips</option>
              <option value="subscription">Subscriptions</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">
              Status
            </span>
            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
            >
              <option value="all">Any status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
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
            href="/admin/payments"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-text transition-colors hover:text-main-text"
          >
            Reset
          </Link>
        </form>

        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
            <Receipt className="h-4 w-4 text-accent" />
            Recent activity
          </h2>
          <p className="text-[11px] text-muted-text">Showing up to 200 newest items.</p>
        </div>

        {activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center text-xs">
            No payment activity matches this filter.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.map(item => (
              <article
                key={item.id}
                className="rounded-2xl border border-border bg-surface/60 p-4 transition-colors hover:border-accent/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-main-text">
                        {item.kindLabel}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-[11px] text-muted-text">
                      Client: <span className="text-main-text">{item.client}</span>
                      {' · '}Phone:{' '}
                      <span className="font-semibold tabular-nums text-main-text">
                        {item.phone}
                      </span>
                    </p>
                    <p className="mt-0.5 break-all text-[11px] text-muted-text">
                      Ref: {item.reference} · {item.provider}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-main-text">
                      {item.amount}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-text">
                      {item.createdAtLabel}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  )
}

export const instant = false
