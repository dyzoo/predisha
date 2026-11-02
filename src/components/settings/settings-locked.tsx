import Link from 'next/link'
import { Lock } from 'lucide-react'

export function SettingsLocked() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Lock className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-main-text">Settings are locked</p>
      <p className="mx-auto mt-2 max-w-md text-sm">
        Account settings need a configured database and <code>AUTH_SECRET</code>. This build does not
        fake a session.
      </p>
      <Link
        href="/sign-in"
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
      >
        Go to sign in
      </Link>
    </div>
  )
}
