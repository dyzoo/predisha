import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ArrowRight, CircleAlert, CircleCheck, UserRound } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { SettingsNav } from '@/components/settings/settings-nav'
import { SettingsLocked } from '@/components/settings/settings-locked'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Profile settings',
}

const nameSchema = z.object({
  name: z.string().trim().min(2).max(80),
})

async function updateProfile(formData: FormData) {
  'use server'
  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/settings/profile')

  const parsed = nameSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) redirect('/settings/profile?error=1')

  await prisma.user.update({
    where: { id: viewer.userId },
    data: { name: parsed.data.name },
  })
  revalidatePath('/settings/profile')
  redirect('/settings/profile?saved=1')
}

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Settings" title="Profile">
        <SettingsNav active="/settings/profile" />
        <SettingsLocked />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/settings/profile')

  const account = await prisma.user
    .findUnique({
      where: { id: viewer.userId },
      select: { name: true, email: true, role: true, createdAt: true, emailVerified: true },
    })
    .catch(() => null)

  const { saved, error } = await searchParams

  if (!account) {
    return (
      <PageShell eyebrow="Settings" title="Profile">
        <SettingsNav active="/settings/profile" />
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface/50 p-5 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          Your profile could not be loaded right now.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="Settings"
      title="Profile"
      intro="Your account identity. Email changes are not enabled because they require verification delivery."
    >
      <SettingsNav active="/settings/profile" />

      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-accent">
          <CircleCheck className="h-4 w-4" />
          Profile updated.
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs text-red-200">
          <CircleAlert className="h-4 w-4" />
          Enter a name between 2 and 80 characters.
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <UserRound className="h-4 w-4 text-accent" />
          Account details
        </h2>
        <form action={updateProfile} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-text">Display name</span>
            <input
              type="text"
              name="name"
              defaultValue={account.name ?? ''}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus:border-accent/60"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Save name
          </button>
        </form>

        <dl className="mt-6 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Email</dt>
            <dd className="mt-1 font-semibold text-main-text">{account.email}</dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Role</dt>
            <dd className="mt-1 font-semibold text-main-text">{account.role}</dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Email verified</dt>
            <dd className="mt-1 font-semibold text-main-text">
              {account.emailVerified ? 'Yes' : 'Not yet'}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-muted-text">Member since</dt>
            <dd className="mt-1 font-semibold text-main-text">
              {account.createdAt.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="font-display text-base font-bold text-main-text">Data controls</h2>
        <p className="mt-2 text-xs leading-relaxed">
          Automated account export and deletion are not enabled in this build. Contact the operator
          of this deployment to exercise those rights; verified email delivery is required first.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <SignOutButton />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-main-text transition-colors hover:bg-elevated-surface"
          >
            Back to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  )
}

export const instant = false
