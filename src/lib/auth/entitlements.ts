import type { SubscriptionStatus } from '@prisma/client'

export type Entitlement = 'FREE' | 'PREMIUM' | 'ADMIN'

export interface Viewer {
  userId: string | null
  email: string | null
  name: string | null
  role: 'USER' | 'ADMIN' | null
  entitlement: Entitlement
}

export const ANONYMOUS_VIEWER: Viewer = {
  userId: null,
  email: null,
  name: null,
  role: null,
  entitlement: 'FREE',
}

/**
 * The safe subset of a server-side viewer that may be sent to the browser.
 * Keeping this shape in one place stops the API and client from drifting apart.
 */
export interface ClientViewer {
  userId: string | null
  email: string | null
  name: string | null
  role: 'USER' | 'ADMIN' | null
  entitlement: Entitlement
  premium: boolean
}

export function toClientViewer(viewer: Viewer): ClientViewer {
  return {
    userId: viewer.userId,
    email: viewer.email,
    name: viewer.name,
    role: viewer.role,
    entitlement: viewer.entitlement,
    premium: canViewPremium(viewer),
  }
}

export const FREE_DAILY_PREVIEW_LIMIT = 1

const PREMIUM_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

/**
 * Central entitlement rule. Access is derived from server-side role and
 * subscription state, never from client-provided flags.
 */
export function entitlementFor(
  role: 'USER' | 'ADMIN' | null,
  status: SubscriptionStatus | null,
): Entitlement {
  if (role === 'ADMIN') return 'ADMIN'
  if (status && PREMIUM_STATUSES.includes(status)) return 'PREMIUM'
  return 'FREE'
}

export function canViewPremium(viewer: Viewer): boolean {
  return viewer.entitlement === 'PREMIUM' || viewer.entitlement === 'ADMIN'
}

export function canViewAdmin(viewer: Viewer): boolean {
  return viewer.role === 'ADMIN' && viewer.entitlement === 'ADMIN'
}

/**
 * Demo mode is explicitly labelled and only available outside production. It
 * unlocks the full board so reviewers can inspect the product; the live free
 * tier remains limited by FREE_DAILY_PREVIEW_LIMIT.
 */
export function previewLimit(viewer: Viewer, isDemo: boolean): number | null {
  if (isDemo || canViewPremium(viewer)) return null
  return FREE_DAILY_PREVIEW_LIMIT
}

/**
 * A free account may build one prediction preview. Demo mode is an explicitly
 * labelled review mode and premium/admin accounts are not limited.
 */
export function canUseFreePreview(params: {
  premium: boolean
  demo: boolean
  used: boolean
}): boolean {
  if (params.premium || params.demo) return true
  return !params.used
}

export function shouldClaimFreePreview(params: {
  premium: boolean
  demo: boolean
  signedIn: boolean
}): boolean {
  return params.signedIn && !params.premium && !params.demo
}
