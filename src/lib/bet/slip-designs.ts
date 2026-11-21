import { Prisma, type AdminSlipDesign } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { BetError, isUniqueConstraintError } from './errors'
import { randomCode } from './random'
import { calculateSlipTotals, type SlipTotals } from './slip-design-math'
import { MAX_SELECTIONS, MAX_STAKE_MINOR } from './types'

export type SlipDesignStatus = 'DRAFT' | 'READY' | 'WON'
export type SlipMarker = 'green' | 'gray' | 'red'

export interface SlipDesignSelection {
  id: string
  time: string
  odds: number
  home: string
  away: string
  league: string
  selection: string
  won: boolean
  marker?: SlipMarker
  fixtureId: string | null
  finalScore: string
}

export interface SlipDesignInput {
  title: string | null
  status: SlipDesignStatus
  stakeMinor: number
  bonusMinor: number
  taxPercent: number
  reuseCount: number
  selections: SlipDesignSelection[]
}

export interface SlipDesignView extends SlipDesignInput {
  id: string
  code: string
  totalOdds: number
  winningsMinor: number
  taxMinor: number
  payoutMinor: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export const slipDesignStatusSchema = z.enum(['DRAFT', 'READY', 'WON'])

export const slipDesignSelectionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  time: z.string().trim().max(80),
  odds: z.number().finite().min(1.01).max(1000),
  home: z.string().trim().max(120),
  away: z.string().trim().max(120),
  league: z.string().trim().max(120),
  selection: z.string().trim().max(160),
  won: z.boolean(),
  marker: z.enum(['green', 'gray', 'red']).optional(),
  fixtureId: z.string().trim().max(160).nullable(),
  finalScore: z.string().trim().max(40),
})

export const slipDesignInputSchema = z.object({
  title: z.string().trim().max(120).nullable(),
  status: slipDesignStatusSchema,
  stakeMinor: z.number().int().min(0).max(MAX_STAKE_MINOR),
  bonusMinor: z.number().int().min(0).max(MAX_STAKE_MINOR),
  taxPercent: z.number().finite().min(0).max(50),
  reuseCount: z.number().int().min(1).max(99),
  selections: z.array(slipDesignSelectionSchema).min(1).max(MAX_SELECTIONS),
})

export const slipDesignActionSchema = z.object({
  action: z.enum(['mark-won', 'mark-ready', 'duplicate']),
})

export function calculateSlipDesign(input: SlipDesignInput): SlipTotals {
  return calculateSlipTotals(
    input.selections.map(selection => selection.odds),
    input.stakeMinor,
    input.bonusMinor,
    input.taxPercent,
  )
}

function parseSelections(value: Prisma.JsonValue): SlipDesignSelection[] {
  const parsed = z.array(slipDesignSelectionSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

function toView(row: AdminSlipDesign): SlipDesignView {
  const input = slipDesignInputSchema.parse({
    title: row.title,
    status: row.status,
    stakeMinor: row.stakeMinor,
    bonusMinor: row.bonusMinor,
    taxPercent: row.taxPercent,
    reuseCount: row.reuseCount,
    selections: parseSelections(row.selections),
  })
  return {
    ...input,
    id: row.id,
    code: row.code,
    totalOdds: row.totalOdds,
    winningsMinor: row.winningsMinor,
    taxMinor: row.taxMinor,
    payoutMinor: row.payoutMinor,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `SD-${randomCode(6)}`
    const existing = await prisma.adminSlipDesign.findUnique({ where: { code }, select: { id: true } })
    if (!existing) return code
  }
  throw new BetError('Could not create a unique slip code. Try again.', 500, 'CODE_COLLISION')
}

export async function listSlipDesigns(limit = 50): Promise<SlipDesignView[]> {
  const rows = await prisma.adminSlipDesign.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  })
  return rows.map(toView)
}

export async function getSlipDesign(id: string): Promise<SlipDesignView> {
  const row = await prisma.adminSlipDesign.findUnique({ where: { id } })
  if (!row) throw new BetError('Saved slip not found.', 404, 'SLIP_DESIGN_NOT_FOUND')
  return toView(row)
}

export async function createSlipDesign({
  input,
  actorId,
  ipAddress,
}: {
  input: SlipDesignInput
  actorId: string
  ipAddress?: string | null
}): Promise<SlipDesignView> {
  const totals = calculateSlipDesign(input)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = await uniqueCode()
    try {
      const row = await prisma.$transaction(async tx => {
        const created = await tx.adminSlipDesign.create({
          data: {
            code,
            title: input.title,
            status: input.status,
            selections: input.selections as unknown as Prisma.InputJsonValue,
            stakeMinor: input.stakeMinor,
            bonusMinor: input.bonusMinor,
            taxPercent: input.taxPercent,
            reuseCount: input.reuseCount,
            totalOdds: totals.totalOdds,
            winningsMinor: totals.winningsMinor,
            taxMinor: totals.taxMinor,
            payoutMinor: totals.payoutMinor,
            createdBy: actorId,
          },
        })
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'slip-design.create',
            target: code,
            metadata: { code, title: input.title } as Prisma.InputJsonValue,
            ipAddress: ipAddress ?? null,
          },
        })
        return created
      })
      return toView(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) continue
      throw error
    }
  }
  throw new BetError('Could not create a unique slip code. Try again.', 500, 'CODE_COLLISION')
}

export async function updateSlipDesign({
  id,
  input,
  actorId,
  ipAddress,
}: {
  id: string
  input: SlipDesignInput
  actorId: string
  ipAddress?: string | null
}): Promise<SlipDesignView> {
  const existing = await getSlipDesign(id)
  const totals = calculateSlipDesign(input)
  const row = await prisma.$transaction(async tx => {
    const updated = await tx.adminSlipDesign.update({
      where: { id },
      data: {
        title: input.title,
        status: input.status,
        selections: input.selections as unknown as Prisma.InputJsonValue,
        stakeMinor: input.stakeMinor,
        bonusMinor: input.bonusMinor,
        taxPercent: input.taxPercent,
        reuseCount: input.reuseCount,
        totalOdds: totals.totalOdds,
        winningsMinor: totals.winningsMinor,
        taxMinor: totals.taxMinor,
        payoutMinor: totals.payoutMinor,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: 'slip-design.update',
        target: existing.code,
        metadata: { code: existing.code, status: input.status } as Prisma.InputJsonValue,
        ipAddress: ipAddress ?? null,
      },
    })
    return updated
  })
  return toView(row)
}

export async function setSlipDesignStatus({
  id,
  status,
  actorId,
  ipAddress,
}: {
  id: string
  status: 'READY' | 'WON'
  actorId: string
  ipAddress?: string | null
}): Promise<SlipDesignView> {
  const existing = await getSlipDesign(id)
  const marker: SlipMarker = status === 'WON' ? 'green' : 'gray'
  const selections = existing.selections.map(selection => ({
    ...selection,
    won: status === 'WON',
    marker,
  }))
  const input: SlipDesignInput = { ...existing, status, selections }
  const totals = calculateSlipDesign(input)
  const row = await prisma.$transaction(async tx => {
    const updated = await tx.adminSlipDesign.update({
      where: { id },
      data: {
        status,
        selections: selections as unknown as Prisma.InputJsonValue,
        totalOdds: totals.totalOdds,
        winningsMinor: totals.winningsMinor,
        taxMinor: totals.taxMinor,
        payoutMinor: totals.payoutMinor,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: status === 'WON' ? 'slip-design.mark-won' : 'slip-design.mark-ready',
        target: existing.code,
        metadata: { code: existing.code } as Prisma.InputJsonValue,
        ipAddress: ipAddress ?? null,
      },
    })
    return updated
  })
  return toView(row)
}

export async function duplicateSlipDesign({
  id,
  actorId,
  ipAddress,
}: {
  id: string
  actorId: string
  ipAddress?: string | null
}): Promise<SlipDesignView> {
  const existing = await getSlipDesign(id)
  return createSlipDesign({
    input: {
      ...existing,
      title: `${existing.title ?? 'Bet slip'} (copy)`.slice(0, 120),
      status: 'DRAFT',
      selections: existing.selections.map(selection => ({ ...selection, won: false, marker: 'gray' as const })),
    },
    actorId,
    ipAddress,
  })
}

export async function deleteSlipDesign({
  id,
  actorId,
  ipAddress,
}: {
  id: string
  actorId: string
  ipAddress?: string | null
}): Promise<string> {
  const existing = await getSlipDesign(id)
  await prisma.$transaction(async tx => {
    await tx.adminSlipDesign.delete({ where: { id } })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: 'slip-design.delete',
        target: existing.code,
        metadata: { code: existing.code } as Prisma.InputJsonValue,
        ipAddress: ipAddress ?? null,
      },
    })
  })
  return existing.code
}
