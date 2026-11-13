import type { BetAviatorBet } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_AVIATOR_CONFIG,
  getAviatorConfig,
  type AviatorConfig,
} from './aviator-config'
import { BetError, isUniqueConstraintError } from './errors'
import { hashString, mulberry32 } from './random'
import { creditWallet, debitWallet, getWalletView } from './wallet'
import type { AviatorBetView, AviatorRoundView, BetWalletView } from './types'

export function crashPointFor(
  roundId: string,
  config: AviatorConfig = DEFAULT_AVIATOR_CONFIG,
): number {
  const random = mulberry32(hashString(roundId))()
  const raw = (1 - config.houseEdge) / Math.max(0.0001, 1 - random)
  const capped = Math.min(config.maxCrash, Math.max(1, raw))
  return Math.round(capped * 100) / 100
}

export function aviatorRoundAt(
  now: Date,
  config: AviatorConfig = DEFAULT_AVIATOR_CONFIG,
): AviatorRoundView {
  const index = Math.floor(now.getTime() / config.roundMs)
  const roundId = `av-${index}`
  const startsAt = index * config.roundMs
  const endsAt = startsAt + config.roundMs
  const elapsed = now.getTime() - startsAt
  const crashAt = crashPointFor(roundId, config)
  const crashDurationMs = (Math.log(crashAt) / config.growth) * 1000

  let phase: AviatorRoundView['phase'] = 'WAITING'
  let multiplier = 1

  if (elapsed >= config.waitMs) {
    if (elapsed - config.waitMs < crashDurationMs) {
      phase = 'FLYING'
      multiplier = Math.min(
        crashAt,
        Math.exp(((elapsed - config.waitMs) / 1000) * config.growth),
      )
    } else {
      phase = 'CRASHED'
      multiplier = crashAt
    }
  }

  return {
    roundId,
    index,
    phase,
    multiplier: Math.round(multiplier * 100) / 100,
    crashAt,
    startsAtIso: new Date(startsAt).toISOString(),
    endsAtIso: new Date(endsAt).toISOString(),
    waitRemainingMs: phase === 'WAITING' ? config.waitMs - elapsed : 0,
    flyElapsedMs: Math.max(0, elapsed - config.waitMs),
  }
}

function toAviatorBetView(bet: BetAviatorBet): AviatorBetView {
  return {
    id: bet.id,
    roundId: bet.roundId,
    slot: bet.slot,
    stakeMinor: bet.stakeMinor,
    autoCashout: bet.autoCashout,
    cashedOutAt: bet.cashedOutAt,
    payoutMinor: bet.payoutMinor,
    status: bet.status,
  }
}

function roundIndexFromId(roundId: string): number {
  const parsed = Number.parseInt(roundId.replace('av-', ''), 10)
  return Number.isFinite(parsed) ? parsed : -1
}

export async function placeAviatorBet(
  userId: string,
  input: { stakeMinor: number; slot: number; autoCashout?: number },
  now: Date = new Date(),
): Promise<{ bet: AviatorBetView; wallet: BetWalletView }> {
  const config = await getAviatorConfig()
  if (!config.enabled) {
    throw new BetError(
      'Aviator is paused by the operator. Try again when betting reopens.',
      503,
      'AVIATOR_DISABLED',
    )
  }
  if (input.autoCashout !== undefined && input.autoCashout > config.maxCrash) {
    throw new BetError(
      `Auto cash out must be ${config.maxCrash.toFixed(2)}x or lower for this game.`,
      422,
      'AUTO_CASHOUT_TOO_HIGH',
    )
  }

  const round = aviatorRoundAt(now, config)
  if (round.phase !== 'WAITING') {
    throw new BetError('Betting is closed for this round.', 409, 'ROUND_CLOSED', {
      round,
    })
  }

  try {
    const bet = await prisma.$transaction(async tx => {
      const created = await tx.betAviatorBet.create({
        data: {
          userId,
          roundId: round.roundId,
          slot: input.slot,
          stakeMinor: input.stakeMinor,
          autoCashout: input.autoCashout,
        },
      })
      await debitWallet(tx, {
        userId,
        amountMinor: input.stakeMinor,
        type: 'GAME_STAKE',
        reference: `aviator:${created.id}:stake`,
        note: `Aviator ${round.roundId}`,
      })
      return created
    })
    return { bet: toAviatorBetView(bet), wallet: await getWalletView(userId) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BetError('That seat is already taken for this round.', 409, 'SEAT_TAKEN')
    }
    throw error
  }
}

export async function cashoutAviator(
  userId: string,
  betId: string,
  now: Date = new Date(),
): Promise<{ bet: AviatorBetView; wallet: BetWalletView }> {
  const bet = await prisma.betAviatorBet.findFirst({ where: { id: betId, userId } })
  if (!bet) throw new BetError('Bet not found.', 404, 'BET_NOT_FOUND')
  if (bet.status !== 'ACTIVE') {
    throw new BetError('That bet is already settled.', 409, 'BET_CLOSED')
  }

  const config = await getAviatorConfig()
  const round = aviatorRoundAt(now, config)
  if (bet.roundId !== round.roundId) {
    throw new BetError('That round is already over.', 409, 'ROUND_OVER')
  }
  if (round.phase !== 'FLYING') {
    throw new BetError('Cash out is not available right now.', 409, 'CASHOUT_CLOSED')
  }

  const payoutMinor = Math.max(1, Math.floor(bet.stakeMinor * round.multiplier))

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.betAviatorBet.updateMany({
      where: { id: bet.id, userId, status: 'ACTIVE' },
      data: {
        status: 'CASHED_OUT',
        cashedOutAt: round.multiplier,
        payoutMinor,
        settledAt: now,
      },
    })
    if (result.count === 0) {
      throw new BetError('That bet is already settled.', 409, 'BET_CLOSED')
    }
    await creditWallet(tx, {
      userId,
      amountMinor: payoutMinor,
      type: 'GAME_WIN',
      reference: `aviator:${bet.id}:cashout`,
      note: `Aviator cash out ${round.multiplier.toFixed(2)}x`,
    })
    return tx.betAviatorBet.findUniqueOrThrow({ where: { id: bet.id } })
  })

  return { bet: toAviatorBetView(updated), wallet: await getWalletView(userId) }
}

export async function settleAviatorForUser(
  userId: string,
  now: Date,
  config: AviatorConfig = DEFAULT_AVIATOR_CONFIG,
): Promise<void> {
  const round = aviatorRoundAt(now, config)
  const active = await prisma.betAviatorBet.findMany({
    where: { userId, status: 'ACTIVE' },
  })

  for (const bet of active) {
    const betIndex = roundIndexFromId(bet.roundId)

    if (betIndex < round.index) {
      await prisma.betAviatorBet.updateMany({
        where: { id: bet.id, userId, status: 'ACTIVE' },
        data: { status: 'LOST', settledAt: now },
      })
      continue
    }

    if (betIndex !== round.index) continue

    if (round.phase === 'CRASHED') {
      await prisma.betAviatorBet.updateMany({
        where: { id: bet.id, userId, status: 'ACTIVE' },
        data: { status: 'LOST', settledAt: now },
      })
      continue
    }

    const autoCashout = bet.autoCashout
    if (
      round.phase === 'FLYING' &&
      autoCashout !== null &&
      round.multiplier >= autoCashout
    ) {
      const payoutMinor = Math.max(1, Math.floor(bet.stakeMinor * autoCashout))
      await prisma.$transaction(async tx => {
        const result = await tx.betAviatorBet.updateMany({
          where: { id: bet.id, userId, status: 'ACTIVE' },
          data: {
            status: 'CASHED_OUT',
            cashedOutAt: autoCashout,
            payoutMinor,
            settledAt: now,
          },
        })
        if (result.count === 0) return
        await creditWallet(tx, {
          userId,
          amountMinor: payoutMinor,
          type: 'GAME_WIN',
          reference: `aviator:${bet.id}:cashout`,
          note: `Aviator auto cash out ${autoCashout.toFixed(2)}x`,
        })
      })
    }
  }
}

export interface AviatorState {
  round: AviatorRoundView
  bets: AviatorBetView[]
  history: Array<{ roundId: string; crashAt: number }>
  wallet: BetWalletView
  config: AviatorConfig
}

export async function getAviatorState(
  userId: string,
  now: Date = new Date(),
): Promise<AviatorState> {
  const config = await getAviatorConfig()
  await settleAviatorForUser(userId, now, config)
  const round = aviatorRoundAt(now, config)
  const [bets, wallet] = await Promise.all([
    prisma.betAviatorBet.findMany({
      where: { userId, roundId: round.roundId },
      orderBy: { slot: 'asc' },
    }),
    getWalletView(userId),
  ])

  const history = Array.from({ length: 10 }, (_, offset) => {
    const index = round.index - 1 - offset
    const roundId = `av-${index}`
    return { roundId, crashAt: crashPointFor(roundId, config) }
  })

  return {
    round,
    bets: bets.map(toAviatorBetView),
    history,
    wallet,
    config,
  }
}
