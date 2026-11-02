import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { safeNextPath } from '@/lib/auth/redirect'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Create account',
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const nextPath = safeNextPath(next)
  const viewer = await getViewer()
  if (viewer.userId) redirect(nextPath ?? '/dashboard')

  return (
    <AuthShell mode="sign-up" authConfigured={isAuthConfigured()} nextPath={nextPath ?? undefined} />
  )
}

export const instant = false
