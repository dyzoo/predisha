import { z } from 'zod'
import {
  MAX_SELECTIONS,
  MAX_STAKE_MINOR,
  MIN_STAKE_MINOR,
} from './types'

const stakeSchema = z
  .number()
  .int('Stake must be a whole amount.')
  .min(MIN_STAKE_MINOR, `Minimum stake is ${MIN_STAKE_MINOR} TZS.`)
  .max(MAX_STAKE_MINOR, `Maximum stake is ${MAX_STAKE_MINOR} TZS.`)

export const selectionInputSchema = z.object({
  fixtureId: z.string().trim().min(1).max(160),
  marketId: z.string().trim().min(1).max(80),
  selectionId: z.string().trim().min(1).max(80),
  odds: z.number().finite().min(1.01).max(1000),
})

export const placeBetSchema = z
  .object({
    stakeMinor: stakeSchema,
    selections: z.array(selectionInputSchema).min(1).max(MAX_SELECTIONS),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    for (const selection of value.selections) {
      const key = `${selection.fixtureId}:${selection.marketId}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Choose only one selection per market.',
          path: ['selections'],
        })
        return
      }
      seen.add(key)
    }
  })

const referenceSchema = z
  .string()
  .trim()
  .min(6)
  .max(80)
  .regex(/^[A-Za-z0-9:_-]+$/, 'Use letters, numbers, colon, underscore or dash only.')

export const depositSchema = z.object({
  amountMinor: z.number().int().min(1_000).max(1_000_000),
  phone: z.string().trim().min(7).max(20).optional(),
  reference: referenceSchema.optional(),
})

export const withdrawSchema = z.object({
  amountMinor: z.number().int().min(1_000).max(1_000_000),
  phone: z.string().trim().min(7).max(20),
  reference: referenceSchema.optional(),
})

export const shareCreateSchema = z.object({
  selections: z.array(selectionInputSchema).min(1).max(MAX_SELECTIONS),
})

export const shareCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'Enter a 6-character share code.')

export const promoClaimSchema = z.object({
  promoId: z.string().trim().min(1).max(80),
})

export const aviatorBetSchema = z.object({
  stakeMinor: stakeSchema,
  slot: z.number().int().min(1).max(2),
  autoCashout: z.number().min(1.1).max(500).optional(),
})

export const aviatorCashoutSchema = z.object({
  betId: z.string().trim().min(1).max(80),
})

export const minesStartSchema = z.object({
  stakeMinor: stakeSchema,
  mines: z.number().int().min(1).max(24),
})

export const minesRevealSchema = z.object({
  roundId: z.string().trim().min(1).max(80),
  tile: z.number().int().min(0).max(24),
})

export const minesCashoutSchema = z.object({
  roundId: z.string().trim().min(1).max(80),
})

export const dicePlaySchema = z.object({
  game: z.literal('dice'),
  stakeMinor: stakeSchema,
  target: z.number().min(2).max(98),
  direction: z.enum(['OVER', 'UNDER']),
})

export const roulettePlaySchema = z
  .object({
    game: z.literal('roulette'),
    stakeMinor: stakeSchema,
    bet: z.enum(['RED', 'BLACK', 'EVEN', 'ODD', 'LOW', 'HIGH', 'NUMBER']),
    number: z.number().int().min(0).max(36).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.bet === 'NUMBER' && typeof value.number !== 'number') {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a number from 0 to 36.',
        path: ['number'],
      })
    }
  })

export const slotsPlaySchema = z.object({
  game: z.literal('slots'),
  stakeMinor: stakeSchema,
})

export const gamePlaySchema = z.discriminatedUnion('game', [
  dicePlaySchema,
  roulettePlaySchema,
  slotsPlaySchema,
])

export const adminSlipSelectionSchema = z.object({
  fixtureId: z.string().trim().min(1).max(160),
  marketId: z.string().trim().min(1).max(80),
  selectionId: z.string().trim().min(1).max(80),
  odds: z.number().finite().min(1.01).max(1000),
})

export const adminSlipCreateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  stakeMinor: z.number().int().min(MIN_STAKE_MINOR).max(MAX_STAKE_MINOR),
  selections: z.array(adminSlipSelectionSchema).min(1).max(MAX_SELECTIONS),
})

export const adminSlipActionSchema = z.object({
  action: z.enum(['freeze', 'unfreeze', 'close']),
  reason: z.string().trim().max(200).optional(),
})

export const adminEntryActionSchema = z.object({
  action: z.enum(['retry', 'simulate-win']).default('retry'),
})

export const slipPaySchema = z.object({
  phone: z.string().trim().min(7).max(20),
})

export const adminPlatformModeSchema = z.object({
  mode: z.enum(['LIVE', 'SANDBOX']),
})

export const aviatorSettingsSchema = z
  .object({
    enabled: z.boolean(),
    waitSeconds: z.number().int().min(2).max(30),
    roundSeconds: z.number().int().min(10).max(300),
    growth: z.number().min(0.05).max(0.5),
    maxCrash: z.number().min(1.1).max(500),
    houseEdge: z.number().min(0).max(0.25),
  })
  .superRefine((value, ctx) => {
    const waitMs = value.waitSeconds * 1000
    const roundMs = value.roundSeconds * 1000
    const longestFlightMs = (Math.log(value.maxCrash) / value.growth) * 1000
    if (waitMs + longestFlightMs > roundMs) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Increase the round length or lower the maximum crash multiplier so every flight can finish before the next round.',
        path: ['roundSeconds'],
      })
    }
  })

export type PlaceBetInput = z.infer<typeof placeBetSchema>
export type AdminSlipCreateInput = z.infer<typeof adminSlipCreateSchema>
export type SelectionInput = z.infer<typeof selectionInputSchema>
export type DepositInput = z.infer<typeof depositSchema>
export type WithdrawInput = z.infer<typeof withdrawSchema>
export type ShareCreateInput = z.infer<typeof shareCreateSchema>
export type AviatorBetInput = z.infer<typeof aviatorBetSchema>
export type MinesStartInput = z.infer<typeof minesStartSchema>
export type GamePlayInput = z.infer<typeof gamePlaySchema>
