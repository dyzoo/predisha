import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getViewer } from './session'

const sessionFindUnique = vi.mocked(prisma.session.findUnique)
const userFindUnique = vi.mocked(prisma.user.findUnique)

function mockCookie(token: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: () => (token ? { name: 'spotibet_session', value: token } : undefined),
  } as never)
}

function fallbackToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + 60_000 }),
  ).toString('base64url')
  const signature = createHmac('sha256', 'test-secret').update(payload).digest('base64url')
  return `v1.${payload}.${signature}`
}

describe('getViewer', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/spotibet'
    process.env.AUTH_SECRET = 'test-secret'
    sessionFindUnique.mockReset()
    userFindUnique.mockReset()
    mockCookie('db-session-token')
  })

  it('reads isSpecial from the session user', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session',
      sessionToken: 'db-session-token',
      expires: new Date(Date.now() + 60_000),
      user: {
        id: 'user',
        email: 'special@example.com',
        name: 'Special User',
        role: 'USER',
        isSpecial: true,
        subscription: null,
      },
    } as never)

    await expect(getViewer()).resolves.toMatchObject({
      userId: 'user',
      isSpecial: true,
    })

    const firstCall = sessionFindUnique.mock.calls[0]?.[0] as {
      select?: { user?: { select?: Record<string, unknown> } }
    }
    expect(firstCall.select?.user?.select).toHaveProperty('isSpecial', true)
  })

  it('falls back to the legacy select when the column is missing', async () => {
    sessionFindUnique
      .mockRejectedValueOnce(Object.assign(new Error('column does not exist'), { code: 'P2022' }))
      .mockResolvedValueOnce({
        id: 'session',
        sessionToken: 'db-session-token',
        expires: new Date(Date.now() + 60_000),
        user: {
          id: 'user',
          email: 'special@example.com',
          name: 'Special User',
          role: 'USER',
          subscription: null,
        },
      } as never)

    await expect(getViewer()).resolves.toMatchObject({
      userId: 'user',
      isSpecial: false,
    })
    expect(sessionFindUnique).toHaveBeenCalledTimes(2)
  })

  it('falls back to the legacy user lookup for signed fallback tokens', async () => {
    mockCookie(fallbackToken('user'))
    sessionFindUnique.mockResolvedValue(null)
    userFindUnique.mockResolvedValue({
      id: 'user',
      email: 'special@example.com',
      name: 'Special User',
      role: 'USER',
      subscription: null,
    } as never)

    await expect(getViewer()).resolves.toMatchObject({
      userId: 'user',
      isSpecial: false,
    })
    expect(userFindUnique).toHaveBeenCalledTimes(1)
  })
})
