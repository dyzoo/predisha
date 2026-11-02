import { describe, expect, it } from 'vitest'
import {
  canUseFreePreview,
  canViewAdmin,
  canViewPremium,
  entitlementFor,
  previewLimit,
  shouldClaimFreePreview,
  toClientViewer,
  ANONYMOUS_VIEWER,
  type Viewer,
} from './entitlements'

function viewer(entitlement: Viewer['entitlement'], role: Viewer['role']): Viewer {
  return { userId: 'user', email: 'user@example.com', name: 'Test User', role, entitlement }
}

describe('entitlements', () => {
  it('derives access from server-side role and subscription status', () => {
    expect(entitlementFor('ADMIN', null)).toBe('ADMIN')
    expect(entitlementFor('ADMIN', 'ACTIVE')).toBe('ADMIN')
    expect(entitlementFor('USER', 'ACTIVE')).toBe('PREMIUM')
    expect(entitlementFor('USER', 'TRIALING')).toBe('PREMIUM')
    expect(entitlementFor('USER', 'PAST_DUE')).toBe('FREE')
    expect(entitlementFor('USER', 'CANCELED')).toBe('FREE')
    expect(entitlementFor(null, 'ACTIVE')).toBe('PREMIUM')
    expect(entitlementFor(null, null)).toBe('FREE')
  })

  it('requires both role and entitlement for admin access', () => {
    expect(canViewAdmin(viewer('ADMIN', 'ADMIN'))).toBe(true)
    expect(canViewAdmin(viewer('PREMIUM', 'USER'))).toBe(false)
    expect(canViewAdmin(viewer('FREE', 'USER'))).toBe(false)
    expect(canViewAdmin(viewer('ADMIN', 'USER'))).toBe(false)
  })

  it('limits free previews but unlocks demo and premium', () => {
    expect(previewLimit(viewer('FREE', null), false)).toBe(1)
    expect(previewLimit(viewer('PREMIUM', 'USER'), false)).toBeNull()
    expect(previewLimit(viewer('ADMIN', 'ADMIN'), false)).toBeNull()
    expect(previewLimit(viewer('FREE', null), true)).toBeNull()
    expect(canViewPremium(viewer('PREMIUM', 'USER'))).toBe(true)
    expect(canViewPremium(viewer('FREE', null))).toBe(false)
  })

  it('allows one free preview per account unless premium or demo', () => {
    expect(canUseFreePreview({ premium: false, demo: false, used: false })).toBe(true)
    expect(canUseFreePreview({ premium: false, demo: false, used: true })).toBe(false)
    expect(canUseFreePreview({ premium: true, demo: false, used: true })).toBe(true)
    expect(canUseFreePreview({ premium: false, demo: true, used: true })).toBe(true)
  })

  it('claims a free preview only for signed-in, non-premium, non-demo users', () => {
    expect(shouldClaimFreePreview({ premium: false, demo: false, signedIn: true })).toBe(true)
    expect(shouldClaimFreePreview({ premium: false, demo: false, signedIn: false })).toBe(false)
    expect(shouldClaimFreePreview({ premium: true, demo: false, signedIn: true })).toBe(false)
    expect(shouldClaimFreePreview({ premium: false, demo: true, signedIn: true })).toBe(false)
  })
})

describe('toClientViewer', () => {
  it('returns the userId field the client reads, never a raw server field', () => {
    const client = toClientViewer(viewer('PREMIUM', 'USER'))
    expect(client).toEqual({
      userId: 'user',
      email: 'user@example.com',
      name: 'Test User',
      role: 'USER',
      entitlement: 'PREMIUM',
      premium: true,
    })
    expect(client).not.toHaveProperty('id')
  })

  it('maps the anonymous viewer to a signed-out client shape', () => {
    expect(toClientViewer(ANONYMOUS_VIEWER)).toEqual({
      userId: null,
      email: null,
      name: null,
      role: null,
      entitlement: 'FREE',
      premium: false,
    })
  })
})
