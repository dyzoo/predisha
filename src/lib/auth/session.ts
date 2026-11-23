import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  ANONYMOUS_VIEWER,
  entitlementFor,
  type Viewer,
} from './entitlements'

export const SESSION_COOKIE = 'spotibet_session'
const SESSION_DAYS = 30
const FALLBACK_SESSION_VERSION = 'v1'

function fallbackSessionSecret(): string {
  return process.env.AUTH_SECRET ?? ''
}

function createFallbackSessionToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString('base64url')
  const signature = createHmac('sha256', fallbackSessionSecret())
    .update(payload)
    .digest('base64url')
  return `${FALLBACK_SESSION_VERSION}.${payload}.${signature}`
}

function readFallbackSessionToken(token: string): string | null {
  const [version, payload, signature] = token.split('.')
  if (version !== FALLBACK_SESSION_VERSION || !payload || !signature) return null
  const expected = createHmac('sha256', fallbackSessionSecret())
    .update(payload)
    .digest('base64url')
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown
      exp?: unknown
    }
    if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null
    if (parsed.exp <= Date.now()) return null
    return parsed.sub
  } catch {
    return null
  }
}

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
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  let token: string

  try {
    token = randomBytes(32).toString('hex')
    await prisma.session
      .deleteMany({ where: { userId, expires: { lt: new Date() } } })
      .catch(() => undefined)
    await prisma.session.create({ data: { sessionToken: token, userId, expires } })
  } catch {
    token = createFallbackSessionToken(userId)
  }

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
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  isSpecial?: boolean
  subscription: { status: string } | null
}

const VIEWER_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isSpecial: true,
  subscription: { select: { status: true } },
}

const LEGACY_VIEWER_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  subscription: { select: { status: true } },
}

function missingIsSpecialColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === 'P2022') return true
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('isSpecial') && message.includes('does not exist')
}

async function findUserForViewer(userId: string): Promise<SessionUser | null> {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: VIEWER_USER_SELECT,
    })
  } catch (error) {
    if (!missingIsSpecialColumn(error)) throw error
    return await prisma.user.findUnique({
      where: { id: userId },
      select: LEGACY_VIEWER_USER_SELECT,
    })
  }
}

async function findSessionForViewer(token: string) {
  try {
    return await prisma.session.findUnique({
      where: { sessionToken: token },
      select: {
        id: true,
        sessionToken: true,
        expires: true,
        user: { select: VIEWER_USER_SELECT },
      },
    })
  } catch (error) {
    if (!missingIsSpecialColumn(error)) throw error
    return await prisma.session.findUnique({
      where: { sessionToken: token },
      select: {
        id: true,
        sessionToken: true,
        expires: true,
        user: { select: LEGACY_VIEWER_USER_SELECT },
      },
    })
  }
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
    isSpecial: user.isSpecial ?? false,
    entitlement: entitlementFor(user.role, status),
  }
}

async function viewerFromFallbackToken(token: string): Promise<Viewer | null> {
  const userId = readFallbackSessionToken(token)
  if (!userId) return null
  const user = await findUserForViewer(userId)
  return user ? toViewer(user) : null
}

export async function getViewer(): Promise<Viewer> {
  if (!isAuthConfigured()) return ANONYMOUS_VIEWER

  let token: string | undefined
  try {
    const store = await cookies()
    token = store.get(SESSION_COOKIE)?.value
    if (!token) return ANONYMOUS_VIEWER

    const session = await findSessionForViewer(token)

    if (!session || session.expires.getTime() < Date.now()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
      }
      return (await viewerFromFallbackToken(token).catch(() => null)) ?? ANONYMOUS_VIEWER
    }

    return toViewer(session.user)
  } catch {
    return token
      ? ((await viewerFromFallbackToken(token).catch(() => null)) ?? ANONYMOUS_VIEWER)
      : ANONYMOUS_VIEWER
  }
}

export async function getAuthenticatedViewer(): Promise<Viewer | null> {
  const viewer = await getViewer()
  return viewer.userId ? viewer : null
}
