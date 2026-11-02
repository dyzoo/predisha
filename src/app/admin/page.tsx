import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Database,
  Lock,
  Radio,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { AdminNav } from '@/components/admin/admin-nav'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { getPublicPlans } from '@/lib/billing/plans'
import { MODEL_VERSION } from '@/lib/predictions/engine'
import { prisma } from '@/lib/prisma'
import { getMatchAnalyses, summarizeEvaluations } from '@/lib/sports/service'

export const metadata: Metadata = {
  title: 'Admin',
}

export default async function AdminPage() {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Admin" title="Admin console">
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold text-main-text">Admin is not configured yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            The admin console needs a database and configured authentication. No admin data is
            exposed without a verified server-side session.
          </p>
        </div>
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/admin')

  if (!canViewAdmin(viewer)) {
    return (
      <PageShell eyebrow="Admin" title="Access denied">
        <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-400/15 text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold text-main-text">Administrator access required</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            Your account is signed in but does not have the ADMIN role. Roles are checked on the
            server for every request.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            Back to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </PageShell>
    )
  }

  const [{ analyses, dataset }, counts, auditLogs] = await Promise.all([
    getMatchAnalyses(),
    prisma.user
      .aggregate({ _count: { _all: true } })
      .then(async users => {
        const [saved, predictions, evaluations] = await Promise.all([
          prisma.savedFixture.count(),
          prisma.prediction.count(),
          prisma.predictionEvaluation.count(),
        ])
        return { users: users._count._all, saved, predictions, evaluations }
      })
      .catch(() => null),
    prisma.adminAuditLog
      .findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, action: true, target: true, createdAt: true } })
      .catch(() => []),
  ])

  const summary = summarizeEvaluations(analyses)
  const plans = getPublicPlans()
  const scheduled = analyses.filter(item => item.fixture.status === 'SCHEDULED').length
  const live = analyses.filter(item => item.fixture.status === 'LIVE').length
  const finished = analyses.filter(item => item.fixture.status === 'FINISHED').length
  const withheld = analyses.filter(item => item.prediction === null).length
  const flags = analyses.flatMap(item => item.prediction?.qualityFlags ?? [])

  return (
    <PageShell
      eyebrow="Admin"
      title="Admin console"
      intro="Operational snapshot from the configured provider and database. Every value is read server-side."
    >
      <AdminNav active="/admin" />

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Radio className="h-4 w-4 text-accent" />
          Provider health
        </h2>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Mode</dt>
            <dd className="mt-1 font-semibold text-main-text">{dataset.health.mode}</dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Status</dt>
            <dd className={`mt-1 font-semibold ${dataset.health.ok ? 'text-accent' : 'text-red-300'}`}>
              {dataset.health.ok ? 'Operational' : 'Degraded'}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3 sm:col-span-2">
            <dt className="text-muted-text">Message</dt>
            <dd className="mt-1 text-main-text">{dataset.health.message}</dd>
          </div>
        </dl>
        {dataset.isDemo ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Demo provider active. These fixtures and probabilities are fictional and must not be
            presented as real predictions.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Activity className="h-4 w-4 text-accent" />
          Prediction coverage
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {[
            { label: 'Scheduled', value: scheduled },
            { label: 'Live', value: live },
            { label: 'Finished', value: finished },
            { label: 'Withheld', value: withheld },
            { label: 'Evaluated', value: summary.sampleSize },
            { label: 'Flags', value: flags.length },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="text-muted-text">{item.label}</dt>
              <dd className="mt-1 font-display text-xl font-bold tabular-nums text-main-text">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed">
          Model <span className="font-semibold text-main-text">{MODEL_VERSION}</span>. Brier score:{' '}
          {summary.brierScore === null ? 'not enough data' : summary.brierScore.toFixed(4)}. Log loss:{' '}
          {summary.logLoss === null ? 'not enough data' : summary.logLoss.toFixed(4)}. A small demo
          sample is not evidence of real-world performance.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <Database className="h-4 w-4 text-accent" />
          Database
        </h2>
        {counts ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {[
              { label: 'Users', value: counts.users },
              { label: 'Saved', value: counts.saved },
              { label: 'Predictions', value: counts.predictions },
              { label: 'Evaluations', value: counts.evaluations },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border bg-background/40 p-3">
                <dt className="text-muted-text">{item.label}</dt>
                <dd className="mt-1 font-display text-xl font-bold tabular-nums text-main-text">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-xs">Database counts are unavailable right now.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Billing
        </h2>
        <p className="mt-3 text-xs leading-relaxed">
          Provider: <span className="font-semibold text-main-text">{plans.provider}</span>. Live
          billing: <span className="font-semibold text-main-text">{plans.billingEnabled ? 'enabled' : 'disabled'}</span>.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed">{plans.notice}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="font-display text-base font-bold text-main-text">Recent audit events</h2>
        {auditLogs.length === 0 ? (
          <p className="mt-3 text-xs">No audit events recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {auditLogs.map(log => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2"
              >
                <span className="font-semibold text-main-text">{log.action}</span>
                <span>{log.target ?? '—'}</span>
                <span className="text-[10px] text-muted-text">
                  {log.createdAt.toISOString().replace('T', ' ').slice(0, 16)} UTC
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}

export const instant = false
