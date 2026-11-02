import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  ANONYMOUS_VIEWER,
  entitlementFor,
  type Viewer,
} from './entitlements'

export const SESSION_COOKIE = 'predisha_session'
const SESSION_DAYS = 30

export function isAuthConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET)
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
    maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)),
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  // Housekeeping: drop this account's already-expired sessions so the table
  // does not grow without bound. Failure here must not block sign-in.
  await prisma.session
    .deleteMany({ where: { userId, expires: { lt: new Date() } } })
    .catch(() => undefined)

  await prisma.session.create({ data: { sessionToken: token, userId, expires } })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, cookieOptions(expires))
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } }).catch(() => undefined)
  }
  store.set(SESSION_COOKIE, '', { ...cookieOptions(new Date(0)), maxAge: 0 })
}

interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'ADMIN'
  subscription: { status: string } | null
}

function toViewer(user: SessionUser): Viewer {
  const status = (user.subscription?.status ?? null) as
    | 'ACTIVE'
    | 'TRIALING'
    | 'INACTIVE'
    | 'PAST_DUE'
    | 'CANCELED'
    | 'UNPAID'
    | null
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    entitlement: entitlementFor(user.role, status),
  }
}

export async function getViewer(): Promise<Viewer> {
  if (!isAuthConfigured()) return ANONYMOUS_VIEWER

  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return ANONYMOUS_VIEWER

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          include: { subscription: { select: { status: true } } },
        },
      },
    })

    if (!session || session.expires.getTime() < Date.now()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
      }
      return ANONYMOUS_VIEWER
    }

    return toViewer(session.user)
  } catch {
    // A database outage must not crash public pages.
    return ANONYMOUS_VIEWER
  }
}

export async function getAuthenticatedViewer(): Promise<Viewer | null> {
  const viewer = await getViewer()
  return viewer.userId ? viewer : null
}
