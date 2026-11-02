import { describe, expect, it } from 'vitest'
import { safeNextPath, withNextPath } from './redirect'

describe('safeNextPath', () => {
  it('keeps internal paths, queries and hashes', () => {
    expect(safeNextPath('/matches/123?tab=stats#form')).toBe('/matches/123?tab=stats#form')
    expect(safeNextPath(['/saved'])).toBe('/saved')
    expect(safeNextPath('/')).toBe('/')
  })

  it('rejects external and protocol-relative destinations', () => {
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('/\\evil.example')).toBeNull()
    expect(safeNextPath('/%5Cevil.example')).toBeNull()
    expect(safeNextPath('/%2F%2Fevil.example')).toBeNull()
    expect(safeNextPath('/dashboard%0ASet-Cookie:%20x=1')).toBeNull()
  })

  it('rejects auth, API and control-character destinations', () => {
    expect(safeNextPath('/sign-in')).toBeNull()
    expect(safeNextPath('/sign-up?next=/dashboard')).toBeNull()
    expect(safeNextPath('/forgot-password')).toBeNull()
    expect(safeNextPath('/api/sports')).toBeNull()
    expect(safeNextPath('/dashboard\nSet-Cookie: x=1')).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })
})

describe('withNextPath', () => {
  it('preserves the next path on auth links', () => {
    expect(withNextPath('/sign-up', '/builder?stake=10')).toBe(
      '/sign-up?next=%2Fbuilder%3Fstake%3D10',
    )
    expect(withNextPath('/sign-in', null)).toBe('/sign-in')
  })
})
