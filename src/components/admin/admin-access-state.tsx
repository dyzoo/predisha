import Link from 'next/link'
import { ArrowRight, Lock, ShieldAlert } from 'lucide-react'

export function AdminAccessState({ status }: { status: 'unconfigured' | 'forbidden' }) {
  if (status === 'unconfigured') {
    return (
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
    )
  }

  return (
    <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-400/15 text-red-300">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-main-text">Administrator access required</p>
      <p className="mx-auto mt-2 max-w-md text-sm">
        Your account is signed in but does not have the ADMIN role. Roles are checked on the server
        for every request.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
      >
        Back to dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
