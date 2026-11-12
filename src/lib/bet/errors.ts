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

export function handleBetError(error: unknown): Response {
  if (error instanceof BetError) {
    return apiError(error.message, error.status, {
      code: error.code,
      ...(error.extra ?? {}),
    })
  }
  console.error('[bet] unhandled route error', error)
  return apiError('Something went wrong. Please try again.', 500, { code: 'INTERNAL' })
}
