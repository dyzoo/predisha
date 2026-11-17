import { prisma } from '@/lib/prisma'
import { MAX_DEPOSIT_MINOR, MIN_DEPOSIT_MINOR } from './types'

export const DEPOSIT_MIN_SETTING_KEY = 'bet.depositMinMinor'

export const MIN_DEPOSIT_LIMIT_MINOR = 1
export const MAX_DEPOSIT_LIMIT_MINOR = MAX_DEPOSIT_MINOR

export function normalizeDepositMinMinor(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return MIN_DEPOSIT_MINOR
  return Math.min(Math.max(parsed, MIN_DEPOSIT_LIMIT_MINOR), MAX_DEPOSIT_LIMIT_MINOR)
}

export async function getDepositMinMinor(): Promise<number> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: DEPOSIT_MIN_SETTING_KEY } })
    if (row) return normalizeDepositMinMinor(row.value)
  } catch {
    // A missing database/table must not take the betting UI down.
  }
  return normalizeDepositMinMinor(process.env.BET_DEPOSIT_MIN_MINOR)
}

export async function setDepositMinMinor(input: {
  amountMinor: number
  actorId: string
  ipAddress?: string | null
}): Promise<number> {
  const next = normalizeDepositMinMinor(input.amountMinor)
  const previous = await getDepositMinMinor()
  const value = String(next)

  await prisma.$transaction(async tx => {
    await tx.platformSetting.upsert({
      where: { key: DEPOSIT_MIN_SETTING_KEY },
      update: { value, updatedBy: input.actorId },
      create: { key: DEPOSIT_MIN_SETTING_KEY, value, updatedBy: input.actorId },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.deposit.min.update',
        target: DEPOSIT_MIN_SETTING_KEY,
        ipAddress: input.ipAddress ?? null,
        metadata: { previous, next },
      },
    })
  })

  return next
}
