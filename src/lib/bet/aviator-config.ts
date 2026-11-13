import { prisma } from '@/lib/prisma'
import { BetError } from './errors'

export const AVIATOR_SETTING_PREFIX = 'aviator.'

export interface AviatorConfig {
  enabled: boolean
  waitMs: number
  roundMs: number
  growth: number
  maxCrash: number
  houseEdge: number
}

export const DEFAULT_AVIATOR_CONFIG: AviatorConfig = {
  enabled: true,
  waitMs: 6_000,
  roundMs: 30_000,
  growth: 0.14,
  maxCrash: 25,
  houseEdge: 0.05,
}

const MIN_WAIT_MS = 2_000
const MAX_WAIT_MS = 30_000
const MIN_ROUND_MS = 10_000
const MAX_ROUND_MS = 300_000
const MIN_GROWTH = 0.05
const MAX_GROWTH = 0.5
const MIN_CRASH = 1.1
const MAX_CRASH_LIMIT = 500
const MAX_HOUSE_EDGE = 0.25

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeAviatorConfig(
  input: Partial<AviatorConfig> | null | undefined,
  fallback: AviatorConfig = DEFAULT_AVIATOR_CONFIG,
): AviatorConfig {
  const waitMs = clamp(
    Math.round(input?.waitMs ?? fallback.waitMs),
    MIN_WAIT_MS,
    MAX_WAIT_MS,
  )
  const roundMs = clamp(
    Math.round(input?.roundMs ?? fallback.roundMs),
    MIN_ROUND_MS,
    MAX_ROUND_MS,
  )
  const growth = clamp(input?.growth ?? fallback.growth, MIN_GROWTH, MAX_GROWTH)
  const maxCrash = clamp(input?.maxCrash ?? fallback.maxCrash, MIN_CRASH, MAX_CRASH_LIMIT)
  const houseEdge = clamp(input?.houseEdge ?? fallback.houseEdge, 0, MAX_HOUSE_EDGE)

  return {
    enabled: input?.enabled ?? fallback.enabled,
    waitMs,
    roundMs,
    growth,
    maxCrash,
    houseEdge,
  }
}

export function longestFlightMs(config: AviatorConfig): number {
  return Math.round((Math.log(config.maxCrash) / config.growth) * 1000)
}

export function aviatorConfigFitsCycle(config: AviatorConfig): boolean {
  return config.waitMs + longestFlightMs(config) <= config.roundMs
}

export function aviatorConfigToSettings(config: AviatorConfig): Record<string, string> {
  return {
    [`${AVIATOR_SETTING_PREFIX}enabled`]: config.enabled ? 'true' : 'false',
    [`${AVIATOR_SETTING_PREFIX}waitMs`]: String(config.waitMs),
    [`${AVIATOR_SETTING_PREFIX}roundMs`]: String(config.roundMs),
    [`${AVIATOR_SETTING_PREFIX}growth`]: String(config.growth),
    [`${AVIATOR_SETTING_PREFIX}maxCrash`]: String(config.maxCrash),
    [`${AVIATOR_SETTING_PREFIX}houseEdge`]: String(config.houseEdge),
  }
}

export async function getAviatorConfig(): Promise<AviatorConfig> {
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { startsWith: AVIATOR_SETTING_PREFIX } },
    })
    const values = new Map(rows.map(row => [row.key, row.value]))
    const rawEnabled = values.get(`${AVIATOR_SETTING_PREFIX}enabled`)

    return normalizeAviatorConfig({
      enabled: rawEnabled === undefined ? undefined : rawEnabled === 'true',
      waitMs: numberFrom(values.get(`${AVIATOR_SETTING_PREFIX}waitMs`), DEFAULT_AVIATOR_CONFIG.waitMs),
      roundMs: numberFrom(values.get(`${AVIATOR_SETTING_PREFIX}roundMs`), DEFAULT_AVIATOR_CONFIG.roundMs),
      growth: numberFrom(values.get(`${AVIATOR_SETTING_PREFIX}growth`), DEFAULT_AVIATOR_CONFIG.growth),
      maxCrash: numberFrom(
        values.get(`${AVIATOR_SETTING_PREFIX}maxCrash`),
        DEFAULT_AVIATOR_CONFIG.maxCrash,
      ),
      houseEdge: numberFrom(
        values.get(`${AVIATOR_SETTING_PREFIX}houseEdge`),
        DEFAULT_AVIATOR_CONFIG.houseEdge,
      ),
    })
  } catch {
    return DEFAULT_AVIATOR_CONFIG
  }
}

export async function setAviatorConfig(input: {
  config: AviatorConfig
  actorId: string
  ipAddress?: string | null
}): Promise<AviatorConfig> {
  const next = normalizeAviatorConfig(input.config)
  if (!aviatorConfigFitsCycle(next)) {
    throw new BetError(
      'The round is too short for that crash ceiling. Increase the round length or lower the maximum crash multiplier.',
      422,
      'AVIATOR_CYCLE_TOO_SHORT',
    )
  }

  const previous = await getAviatorConfig()
  const settings = aviatorConfigToSettings(next)

  await prisma.$transaction(async tx => {
    for (const [key, value] of Object.entries(settings)) {
      await tx.platformSetting.upsert({
        where: { key },
        update: { value, updatedBy: input.actorId },
        create: { key, value, updatedBy: input.actorId },
      })
    }
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.aviator.config.update',
        target: AVIATOR_SETTING_PREFIX,
        ipAddress: input.ipAddress ?? null,
        metadata: { previous: { ...previous }, next: { ...next } },
      },
    })
  })

  return next
}
