import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CircleAlert, CircleCheck, SlidersHorizontal } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { SettingsNav } from '@/components/settings/settings-nav'
import { SettingsLocked } from '@/components/settings/settings-locked'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Preferences',
}

const schema = z.object({
  timezone: z.string().trim().min(1).max(64),
  locale: z.string().trim().min(2).max(20),
  favoriteSports: z.string().max(300),
  favoriteLeagues: z.string().max(300),
})

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

async function updatePreferences(formData: FormData) {
  'use server'
  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/settings/preferences')

  const parsed = schema.safeParse({
    timezone: formData.get('timezone'),
    locale: formData.get('locale'),
    favoriteSports: formData.get('favoriteSports') ?? '',
    favoriteLeagues: formData.get('favoriteLeagues') ?? '',
  })
  if (!parsed.success || !validTimezone(parsed.data.timezone)) {
    redirect('/settings/preferences?error=1')
  }

  await prisma.userPreference.upsert({
    where: { userId: viewer.userId },
    update: {
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      favoriteSports: splitList(parsed.data.favoriteSports),
      favoriteLeagues: splitList(parsed.data.favoriteLeagues),
    },
    create: {
      userId: viewer.userId,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      favoriteSports: splitList(parsed.data.favoriteSports),
      favoriteLeagues: splitList(parsed.data.favoriteLeagues),
    },
  })
  revalidatePath('/settings/preferences')
  revalidatePath('/dashboard')
  redirect('/settings/preferences?saved=1')
}

export default async function PreferencesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await connection()
  if (!isAuthConfigured()) {
    return (
      <PageShell eyebrow="Settings" title="Preferences">
        <SettingsNav active="/settings/preferences" />
        <SettingsLocked />
      </PageShell>
    )
  }

  const viewer = await getViewer()
  if (!viewer.userId) redirect('/sign-in?next=/settings/preferences')

  const preferences = await prisma.userPreference
    .findUnique({ where: { userId: viewer.userId } })
    .catch(() => null)
  const { saved, error } = await searchParams

  return (
    <PageShell
      eyebrow="Settings"
      title="Preferences"
      intro="Control how match times and lists are presented. Preferences apply to your account only."
    >
      <SettingsNav active="/settings/preferences" />

      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-accent">
          <CircleCheck className="h-4 w-4" />
          Preferences saved.
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs text-red-200">
          <CircleAlert className="h-4 w-4" />
          Check the fields. The timezone must be a valid IANA name, for example Europe/London.
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
          <SlidersHorizontal className="h-4 w-4 text-accent" />
          Display and follow list
        </h2>
        <form action={updatePreferences} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-text">Timezone</span>
              <input
                type="text"
                name="timezone"
                defaultValue={preferences?.timezone ?? 'UTC'}
                required
                maxLength={64}
                placeholder="Europe/London"
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus:border-accent/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-text">Locale</span>
              <input
                type="text"
                name="locale"
                defaultValue={preferences?.locale ?? 'en'}
                required
                minLength={2}
                maxLength={20}
                placeholder="en"
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus:border-accent/60"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-text">
              Favourite sports (comma separated)
            </span>
            <input
              type="text"
              name="favoriteSports"
              defaultValue={preferences?.favoriteSports.join(', ') ?? ''}
              maxLength={300}
              placeholder="football"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus:border-accent/60"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-text">
              Favourite competitions (comma separated)
            </span>
            <input
              type="text"
              name="favoriteLeagues"
              defaultValue={preferences?.favoriteLeagues.join(', ') ?? ''}
              maxLength={300}
              placeholder="premier-league"
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-main-text outline-none focus:border-accent/60"
            />
          </label>
          <p className="text-[11px] leading-relaxed">
            A maximum of 20 entries per list is stored. Invalid timezone values are rejected rather
            than silently defaulting.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Save preferences
          </button>
        </form>
      </section>
    </PageShell>
  )
}

export const instant = false
