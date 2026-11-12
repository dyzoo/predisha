import { Prisma, type BetGameRound } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BetError } from './errors'
import { pickWeighted, secureInt } from './random'
import { creditWallet, debitWallet, getWalletView } from './wallet'
import type { BetGameRoundView, BetWalletView } from './types'
import type { GamePlayInput as GamePlaySchemaInput, MinesStartInput as MinesStartSchemaInput } from './validation'

interface MinesDetail {
  mines: number
  minePositions: number[]
  revealed: number[]
}

function parseMinesDetail(value: Prisma.JsonValue): MinesDetail {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const mines = typeof record.mines === 'number' ? record.mines : 3
    const minePositions = Array.isArray(record.minePositions)
      ? record.minePositions.filter((item): item is number => typeof item === 'number')
      : []
    const revealed = Array.isArray(record.revealed)
      ? record.revealed.filter((item): item is number => typeof item === 'number')
      : []
    return { mines, minePositions, revealed }
  }
  return { mines: 3, minePositions: [], revealed: [] }
}

export function minesMultiplier(mines: number, revealed: number): number {
  if (revealed <= 0) return 1
  let probability = 1
  for (let index = 0; index < revealed; index += 1) {
    probability *= (25 - mines - index) / (25 - index)
  }
  if (probability <= 0) return 1
  return Math.min(1000, Math.max(1, Math.round((1 / probability) * 0.97 * 100) / 100))
}

function baseRoundView(round: BetGameRound): BetGameRoundView {
  const detail =
    typeof round.detail === 'object' && round.detail !== null && !Array.isArray(round.detail)
      ? (round.detail as Record<string, unknown>)
      : {}
  return {
    id: round.id,
    game: round.game,
    stakeMinor: round.stakeMinor,
    payoutMinor: round.payoutMinor,
    status: round.status,
    detail,
    createdAt: round.createdAt.toISOString(),
    settledAt: round.settledAt?.toISOString() ?? null,
  }
}

function minesRoundView(round: BetGameRound, includeMines = false): BetGameRoundView {
  const detail = parseMinesDetail(round.detail)
  return {
    ...baseRoundView(round),
    detail: {
      mines: detail.mines,
      revealed: detail.revealed,
      multiplier: minesMultiplier(detail.mines, detail.revealed.length),
      safeRemaining: Math.max(0, 25 - detail.mines - detail.revealed.length),
      ...(includeMines ? { minePositions: detail.minePositions } : {}),
    },
  }
}

async function createGameRound(
  userId: string,
  game: 'MINES' | 'DICE' | 'ROULETTE' | 'SLOTS',
  stakeMinor: number,
  detail: Prisma.InputJsonValue,
  status: 'OPEN' | 'WON' | 'LOST',
  payoutMinor: number,
  note: string,
): Promise<{ round: BetGameRound; wallet: BetWalletView }> {
  const round = await prisma.$transaction(async tx => {
    const created = await tx.betGameRound.create({
      data: {
        userId,
        game,
        stakeMinor,
        payoutMinor,
        status,
        detail,
        settledAt: status === 'OPEN' ? null : new Date(),
      },
    })
    await debitWallet(tx, {
      userId,
      amountMinor: stakeMinor,
      type: 'GAME_STAKE',
      reference: `game:${created.id}:stake`,
      note,
    })
    if (payoutMinor > 0) {
      await creditWallet(tx, {
        userId,
        amountMinor: payoutMinor,
        type: 'GAME_WIN',
        reference: `game:${created.id}:win`,
        note: `${note} payout`,
      })
    }
    return created
  })

  return { round, wallet: await getWalletView(userId) }
}

export async function startMines(
  userId: string,
  input: MinesStartSchemaInput,
): Promise<{ round: BetGameRoundView; wallet: BetWalletView }> {
  const minePositions = new Set<number>()
  while (minePositions.size < input.mines) {
    minePositions.add(secureInt(25))
  }

  const detail: MinesDetail = {
    mines: input.mines,
    minePositions: [...minePositions],
    revealed: [],
  }

  const { round, wallet } = await createGameRound(
    userId,
    'MINES',
    input.stakeMinor,
    detail as unknown as Prisma.InputJsonValue,
    'OPEN',
    0,
    'Mines',
  )

  return { round: minesRoundView(round), wallet }
}

export async function revealMines(
  userId: string,
  input: { roundId: string; tile: number },
  now: Date = new Date(),
): Promise<{
  round: BetGameRoundView
  wallet: BetWalletView
  safe: boolean
  hitMine: boolean
  multiplier: number
  autoCashedOut: boolean
}> {
  const round = await prisma.betGameRound.findFirst({
    where: { id: input.roundId, userId, game: 'MINES' },
  })
  if (!round) throw new BetError('Mines round not found.', 404, 'ROUND_NOT_FOUND')
  if (round.status !== 'OPEN') {
    throw new BetError('This mines round is already finished.', 409, 'ROUND_CLOSED')
  }

  const detail = parseMinesDetail(round.detail)
  if (detail.revealed.includes(input.tile)) {
    throw new BetError('That tile is already revealed.', 409, 'TILE_REVEALED')
  }

  if (detail.minePositions.includes(input.tile)) {
    const updated = await prisma.betGameRound.update({
      where: { id: round.id },
      data: { status: 'LOST', settledAt: now, payoutMinor: 0 },
    })
    return {
      round: minesRoundView(updated, true),
      wallet: await getWalletView(userId),
      safe: false,
      hitMine: true,
      multiplier: 0,
      autoCashedOut: false,
    }
  }

  const revealed = [...detail.revealed, input.tile]
  const multiplier = minesMultiplier(detail.mines, revealed.length)
  const complete = revealed.length >= 25 - detail.mines

  if (!complete) {
    const updated = await prisma.betGameRound.update({
      where: { id: round.id },
      data: {
        detail: { ...detail, revealed } as unknown as Prisma.InputJsonValue,
      },
    })
    return {
      round: minesRoundView(updated),
      wallet: await getWalletView(userId),
      safe: true,
      hitMine: false,
      multiplier,
      autoCashedOut: false,
    }
  }

  const payoutMinor = Math.max(1, Math.floor(round.stakeMinor * multiplier))
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.betGameRound.updateMany({
      where: { id: round.id, userId, status: 'OPEN' },
      data: {
        status: 'WON',
        payoutMinor,
        settledAt: now,
        detail: { ...detail, revealed } as unknown as Prisma.InputJsonValue,
      },
    })
    if (result.count === 0) {
      throw new BetError('This mines round is already finished.', 409, 'ROUND_CLOSED')
    }
    await creditWallet(tx, {
      userId,
      amountMinor: payoutMinor,
      type: 'GAME_WIN',
      reference: `game:${round.id}:win`,
      note: 'Mines full clear',
    })
    return tx.betGameRound.findUniqueOrThrow({ where: { id: round.id } })
  })

  return {
    round: minesRoundView(updated),
    wallet: await getWalletView(userId),
    safe: true,
    hitMine: false,
    multiplier,
    autoCashedOut: true,
  }
}

export async function cashoutMines(
  userId: string,
  input: { roundId: string },
  now: Date = new Date(),
): Promise<{ round: BetGameRoundView; wallet: BetWalletView; multiplier: number }> {
  const round = await prisma.betGameRound.findFirst({
    where: { id: input.roundId, userId, game: 'MINES' },
  })
  if (!round) throw new BetError('Mines round not found.', 404, 'ROUND_NOT_FOUND')
  if (round.status !== 'OPEN') {
    throw new BetError('This mines round is already finished.', 409, 'ROUND_CLOSED')
  }

  const detail = parseMinesDetail(round.detail)
  if (detail.revealed.length === 0) {
    throw new BetError('Reveal at least one tile before cashing out.', 422, 'NO_REVEALS')
  }

  const multiplier = minesMultiplier(detail.mines, detail.revealed.length)
  const payoutMinor = Math.max(1, Math.floor(round.stakeMinor * multiplier))

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.betGameRound.updateMany({
      where: { id: round.id, userId, status: 'OPEN' },
      data: { status: 'WON', payoutMinor, settledAt: now },
    })
    if (result.count === 0) {
      throw new BetError('This mines round is already finished.', 409, 'ROUND_CLOSED')
    }
    await creditWallet(tx, {
      userId,
      amountMinor: payoutMinor,
      type: 'GAME_WIN',
      reference: `game:${round.id}:win`,
      note: `Mines cash out ${multiplier.toFixed(2)}x`,
    })
    return tx.betGameRound.findUniqueOrThrow({ where: { id: round.id } })
  })

  return {
    round: minesRoundView(updated),
    wallet: await getWalletView(userId),
    multiplier,
  }
}

export async function playDice(
  userId: string,
  input: { stakeMinor: number; target: number; direction: 'OVER' | 'UNDER' },
): Promise<{
  round: BetGameRoundView
  wallet: BetWalletView
  outcome: { roll: number; won: boolean; multiplier: number; payoutMinor: number }
}> {
  const roll = secureInt(10_000) / 100
  const winProbability = input.direction === 'OVER' ? (100 - input.target) / 100 : input.target / 100
  const won = input.direction === 'OVER' ? roll > input.target : roll < input.target
  const multiplier = Math.max(1.01, Math.round((0.97 / Math.max(0.01, winProbability)) * 100) / 100)
  const payoutMinor = won ? Math.floor(input.stakeMinor * multiplier) : 0

  const { round, wallet } = await createGameRound(
    userId,
    'DICE',
    input.stakeMinor,
    {
      target: input.target,
      direction: input.direction,
      roll,
      winProbability,
      multiplier,
      won,
      payoutMinor,
    } as unknown as Prisma.InputJsonValue,
    won ? 'WON' : 'LOST',
    payoutMinor,
    'Dice',
  )

  return { round: baseRoundView(round), wallet, outcome: { roll, won, multiplier, payoutMinor } }
}

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export async function playRoulette(
  userId: string,
  input: {
    stakeMinor: number
    bet: 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'LOW' | 'HIGH' | 'NUMBER'
    number?: number
  },
): Promise<{
  round: BetGameRoundView
  wallet: BetWalletView
  outcome: { roll: number; won: boolean; multiplier: number; payoutMinor: number }
}> {
  const roll = secureInt(37)
  let won = false
  let multiplier = 0

  switch (input.bet) {
    case 'RED':
      won = roll !== 0 && RED_NUMBERS.has(roll)
      multiplier = 2
      break
    case 'BLACK':
      won = roll !== 0 && !RED_NUMBERS.has(roll)
      multiplier = 2
      break
    case 'EVEN':
      won = roll !== 0 && roll % 2 === 0
      multiplier = 2
      break
    case 'ODD':
      won = roll % 2 === 1
      multiplier = 2
      break
    case 'LOW':
      won = roll >= 1 && roll <= 18
      multiplier = 2
      break
    case 'HIGH':
      won = roll >= 19 && roll <= 36
      multiplier = 2
      break
    case 'NUMBER':
      won = roll === input.number
      multiplier = 36
      break
  }

  const payoutMinor = won ? Math.floor(input.stakeMinor * multiplier) : 0

  const { round, wallet } = await createGameRound(
    userId,
    'ROULETTE',
    input.stakeMinor,
    {
      bet: input.bet,
      number: input.number ?? null,
      roll,
      won,
      multiplier,
      payoutMinor,
    } as unknown as Prisma.InputJsonValue,
    won ? 'WON' : 'LOST',
    payoutMinor,
    'Roulette',
  )

  return { round: baseRoundView(round), wallet, outcome: { roll, won, multiplier, payoutMinor } }
}

const SLOT_SYMBOLS = [
  { value: 'seven', weight: 1 },
  { value: 'bar', weight: 3 },
  { value: 'bell', weight: 6 },
  { value: 'cherry', weight: 10 },
  { value: 'lemon', weight: 14 },
]

const SLOT_PAYOUTS: Record<string, number> = {
  seven: 50,
  bar: 20,
  bell: 10,
  cherry: 6,
  lemon: 4,
}

export async function playSlots(
  userId: string,
  input: { stakeMinor: number },
): Promise<{
  round: BetGameRoundView
  wallet: BetWalletView
  outcome: { reels: string[]; multiplier: number; payoutMinor: number }
}> {
  const reels = [
    pickWeighted(SLOT_SYMBOLS),
    pickWeighted(SLOT_SYMBOLS),
    pickWeighted(SLOT_SYMBOLS),
  ]

  let multiplier = 0
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = SLOT_PAYOUTS[reels[0]] ?? 0
  } else if (reels.filter(symbol => symbol === 'cherry').length === 2) {
    multiplier = 2
  }

  const payoutMinor = Math.floor(input.stakeMinor * multiplier)

  const { round, wallet } = await createGameRound(
    userId,
    'SLOTS',
    input.stakeMinor,
    {
      reels,
      multiplier,
      payoutMinor,
    } as unknown as Prisma.InputJsonValue,
    payoutMinor > 0 ? 'WON' : 'LOST',
    payoutMinor,
    'Slots',
  )

  return { round: baseRoundView(round), wallet, outcome: { reels, multiplier, payoutMinor } }
}

export async function playGame(
  userId: string,
  input: GamePlaySchemaInput,
): Promise<{
  round: BetGameRoundView
  wallet: BetWalletView
  outcome: Record<string, unknown>
}> {
  if (input.game === 'dice') {
    const result = await playDice(userId, input)
    return { ...result, outcome: result.outcome as unknown as Record<string, unknown> }
  }
  if (input.game === 'roulette') {
    const result = await playRoulette(userId, input)
    return { ...result, outcome: result.outcome as unknown as Record<string, unknown> }
  }
  const result = await playSlots(userId, input)
  return { ...result, outcome: result.outcome as unknown as Record<string, unknown> }
}


