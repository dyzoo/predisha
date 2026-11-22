import { prisma } from '@/lib/prisma'
import { BetError } from './errors'
import { MAX_STAKE_MINOR, MIN_STAKE_MINOR } from './types'

export const MIN_STAKE_SETTING_KEY = 'bet.minStakeMinor'

export function normalizeMinStakeMinor(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return MIN_STAKE_MINOR
  return Math.min(Math.max(parsed, MIN_STAKE_MINOR), MAX_STAKE_MINOR)
}

export async function assertMinStakeMinor(amountMinor: number): Promise<number> {
  const minimum = await getMinStakeMinor()
  if (!Number.isFinite(amountMinor) || amountMinor < minimum) {
    throw new BetError(`Minimum stake is ${minimum} TZS.`, 422, 'BAD_STAKE', { minimum })
  }
  return minimum
}

export async function getMinStakeMinor(): Promise<number> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: MIN_STAKE_SETTING_KEY },
    })
    if (row) return normalizeMinStakeMinor(row.value)
  } catch {
    // A missing database/table must not take the betting UI down.
  }
  return normalizeMinStakeMinor(process.env.BET_MIN_STAKE_MINOR)
}

export async function setMinStakeMinor(input: {
  amountMinor: number
  actorId: string
}): Promise<number> {
  const next = normalizeMinStakeMinor(input.amountMinor)
  const previous = await getMinStakeMinor()
  await prisma.$transaction(async tx => {
    await tx.platformSetting.upsert({
      where: { key: MIN_STAKE_SETTING_KEY },
      update: { value: String(next), updatedBy: input.actorId },
      create: { key: MIN_STAKE_SETTING_KEY, value: String(next), updatedBy: input.actorId },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.bet.min-stake.update',
        target: MIN_STAKE_SETTING_KEY,
        metadata: { previous, next },
      },
    })
  })
  return next
}
