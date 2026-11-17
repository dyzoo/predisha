import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { canViewAdmin } from '@/lib/auth/entitlements'
import { safeNextPath } from '@/lib/auth/redirect'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const nextPath = safeNextPath(next)
  const viewer = await getViewer()
  if (viewer.userId) {
    if (canViewAdmin(viewer)) {
      redirect(nextPath?.startsWith('/admin') ? nextPath : '/admin')
    }
    redirect(nextPath ?? '/dashboard')
  }

  return (
    <AuthShell mode="sign-in" authConfigured={isAuthConfigured()} nextPath={nextPath ?? undefined} />
  )
}

export const instant = false
