'use client'

import Link from 'next/link'
import { useViewer } from '@/components/ui/viewer-provider'

const memberLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/builder', label: 'Build prediction' },
  { href: '/saved', label: 'Saved matches' },
  { href: '/history', label: 'Prediction history' },
  { href: '/settings/profile', label: 'Settings' },
  { href: '/settings/billing', label: 'Billing' },
]

const guestLinks = [
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Create account' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/saved', label: 'Saved matches' },
]

// Shown while the viewer is still loading so a signed-in user never sees a
// "Sign in" link flash before their session is confirmed.
const placeholderLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/saved', label: 'Saved matches' },
  { href: '/history', label: 'Prediction history' },
  { href: '/settings/profile', label: 'Settings' },
]

export function SiteFooterAccount() {
  const { viewer, loading } = useViewer()
  const signedIn = Boolean(viewer?.userId)
  const links = loading ? placeholderLinks : signedIn ? memberLinks : guestLinks

  return (
    <ul className="mt-4 space-y-2.5">
      {links.map(link => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="text-sm text-muted-text transition-colors hover:text-accent"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
