import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CircleAlert, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Reset password',
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-main-text">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface/80 p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Account recovery</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-text">
          Password reset needs a verified email delivery provider. This deployment does not have one
          configured, so no reset email can be sent yet.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The form stays disabled rather than claiming an email was sent. If you are locked out,
            contact the operator of this deployment.
          </p>
        </div>

        <label className="mt-6 block opacity-60">
          <span className="mb-1.5 block text-xs font-medium text-muted-text">Email</span>
          <span className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5">
            <Mail className="h-4 w-4 text-muted-text" />
            <input
              type="email"
              disabled
              placeholder="you@example.com"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-text/60"
            />
          </span>
        </label>

        <Link
          href="/sign-in"
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

export const instant = false
