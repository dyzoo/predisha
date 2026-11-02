import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface FreePreviewState {
  recorded: boolean
  used: boolean
  claimedAt: Date | null
  slipId: string | null
}

const EMPTY_STATE: FreePreviewState = {
  recorded: false,
  used: false,
  claimedAt: null,
  slipId: null,
}

function toState(record: {
  claimedAt: Date
  slipId: string | null
} | null): FreePreviewState {
  if (!record) return EMPTY_STATE
  return {
    recorded: true,
    used: Boolean(record.slipId),
    claimedAt: record.claimedAt,
    slipId: record.slipId,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  )
}

export async function getFreePreviewState(userId: string): Promise<FreePreviewState> {
  try {
    const record = await prisma.userFreePreview.findUnique({
      where: { userId },
      select: { claimedAt: true, slipId: true },
    })
    return toState(record)
  } catch {
    return EMPTY_STATE
  }
}

/**
 * Records the account's free-preview entitlement without consuming it. The
 * entitlement is consumed only when a saved slip is attached, which happens in
 * the build route after a successful model response.
 */
export async function claimFreePreview(userId: string): Promise<{
  state: FreePreviewState
  alreadyClaimed: boolean
}> {
  const existing = await prisma.userFreePreview.findUnique({
    where: { userId },
    select: { claimedAt: true, slipId: true },
  })
  if (existing) {
    return { state: toState(existing), alreadyClaimed: true }
  }

  try {
    const created = await prisma.userFreePreview.create({
      data: { userId },
      select: { claimedAt: true, slipId: true },
    })
    return { state: toState(created), alreadyClaimed: false }
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const record = await prisma.userFreePreview.findUnique({
      where: { userId },
      select: { claimedAt: true, slipId: true },
    })
    return { state: toState(record), alreadyClaimed: true }
  }
}

export class FreePreviewUnavailableError extends Error {
  constructor() {
    super('This account has already used its free prediction preview.')
  }
}

/**
 * Attaches a saved slip to the free-preview entitlement. The conditional update
 * means concurrent builds cannot consume more than one preview.
 */
export async function consumeFreePreview(
  userId: string,
  slipId: string,
): Promise<FreePreviewState> {
  try {
    const created = await prisma.userFreePreview.create({
      data: { userId, slipId },
      select: { claimedAt: true, slipId: true },
    })
    return toState(created)
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
  }

  const updated = await prisma.userFreePreview.updateMany({
    where: { userId, slipId: null },
    data: { slipId },
  })
  if (updated.count === 0) throw new FreePreviewUnavailableError()

  const record = await prisma.userFreePreview.findUnique({
    where: { userId },
    select: { claimedAt: true, slipId: true },
  })
  return toState(record)
}
