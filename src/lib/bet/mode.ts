import { prisma } from '@/lib/prisma'
import {
  BET_MODE_COPY,
  betModeCopy,
  normalizeBetMode,
  type BetMode,
  type BetModeCopy,
} from './mode-copy'

export type { BetMode, BetModeCopy }
export { BET_MODE_COPY, betModeCopy, normalizeBetMode }

export const BET_MODE_SETTING_KEY = 'bet.mode'

export async function getBetMode(): Promise<BetMode> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: BET_MODE_SETTING_KEY },
    })
    if (row) return normalizeBetMode(row.value)
  } catch {
    // A missing database/table must not take the betting UI down.
  }
  return normalizeBetMode(process.env.BET_MODE ?? 'LIVE')
}

export async function setBetMode(mode: BetMode, updatedBy?: string | null): Promise<BetMode> {
  const normalized = normalizeBetMode(mode)
  await prisma.platformSetting.upsert({
    where: { key: BET_MODE_SETTING_KEY },
    update: { value: normalized, updatedBy: updatedBy ?? null },
    create: { key: BET_MODE_SETTING_KEY, value: normalized, updatedBy: updatedBy ?? null },
  })
  return normalized
}

export async function getBetModeCopy(): Promise<BetModeCopy> {
  return betModeCopy(await getBetMode())
}
