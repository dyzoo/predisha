import { apiError } from '@/lib/api'

export class BetError extends Error {
  readonly status: number
  readonly code: string
  readonly extra?: Record<string, unknown>

  constructor(
    message: string,
    status = 400,
    code = 'BET_ERROR',
    extra?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'BetError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  )
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? error.code : null
  if (typeof code === 'string' && /^P100[0-9]$/.test(code)) return true
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return /exceeded the quota|can't reach database server|database.*timeout/i.test(message)
}

export function handleBetError(error: unknown): Response {
  if (error instanceof BetError) {
    return apiError(error.message, error.status, {
      code: error.code,
      ...(error.extra ?? {}),
    })
  }
  if (isDatabaseUnavailable(error)) {
    console.error('[bet] database unavailable', error)
    return apiError('Betting is temporarily unavailable. Please try again shortly.', 503, {
      code: 'SERVICE_UNAVAILABLE',
    })
  }
  console.error('[bet] unhandled route error', error)
  return apiError('Something went wrong. Please try again.', 500, { code: 'INTERNAL' })
}
