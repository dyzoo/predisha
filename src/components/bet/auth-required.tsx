import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'

export function AuthRequired({
  title,
  description,
  nextPath,
}: {
  title: string
  description: string
  nextPath: string
}) {
  const next = encodeURIComponent(nextPath)

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-text">{description}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={`/sign-in?next=${next}`}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          Sign in
        </Link>
        <Link
          href={`/sign-up?next=${next}`}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-main-text hover:border-accent/40"
        >
          Create account
        </Link>
      </div>
      <p className="mt-4 text-[11px] text-muted-text">
        Your PredishaBet wallet is sandbox play money and is separate from any real payment.
      </p>
    </div>
  )
}
