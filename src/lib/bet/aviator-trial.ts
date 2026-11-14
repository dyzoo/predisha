import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { AviatorTrial, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BetError, isUniqueConstraintError } from './errors'
import { maskTzPhone, normalizeTzPhone } from './phone'
import { creditWallet, debitWallet, getWalletView } from './wallet'
import type { BetWalletView } from './types'

export const AVIATOR_TRIAL_COOKIE = 'predisha_aviator_trial'
export const TRIAL_STAKE_MINOR = 1000
export const TRIAL_PRIZE_MULTIPLIER = 63
export const TRIAL_PRIZE_MINOR = TRIAL_STAKE_MINOR * TRIAL_PRIZE_MULTIPLIER
export const TRIAL_WITHDRAWAL_HOURS = 6

const TRIAL_COOKIE_DAYS = 30

export interface AviatorTrialView {
  status: string
  stakeMinor: number
  prizeMinor: number
  multiplier: number
  phoneMasked: string | null
  withdrawalStatus: string
  withdrawalEtaAt: string | null
  canPlay: boolean
  canWithdraw: boolean
}

export interface TrialWithdrawalResult {
  trial: AviatorTrialView
  wallet: BetWalletView
  alreadyRequested: boolean
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
    maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)),
  }
}

async function setTrialCookie(token: string): Promise<void> {
  const expires = new Date(Date.now() + TRIAL_COOKIE_DAYS * 24 * 60 * 60 * 1000)
  const store = await cookies()
  store.set(AVIATOR_TRIAL_COOKIE, token, cookieOptions(expires))
}

export function toTrialView(trial: AviatorTrial): AviatorTrialView {
  return {
    status: trial.status,
    stakeMinor: trial.stakeMinor,
    prizeMinor: trial.prizeMinor,
    multiplier: trial.prizeMinor / Math.max(1, trial.stakeMinor),
    phoneMasked: trial.phone ? maskTzPhone(trial.phone) : null,
    withdrawalStatus: trial.withdrawalStatus,
    withdrawalEtaAt: trial.withdrawalEtaAt?.toISOString() ?? null,
    canPlay: trial.status === 'GRANTED',
    canWithdraw:
      (trial.status === 'PLAYED' || trial.status === 'CLAIMED') &&
      trial.withdrawalStatus === 'NONE',
  }
}

export async function getTrialFromCookie(): Promise<AviatorTrial | null> {
  const store = await cookies()
  const token = store.get(AVIATOR_TRIAL_COOKIE)?.value
  if (!token) return null
  return prisma.aviatorTrial.findUnique({ where: { token } })
}

export async function getTrialViewFromCookie(): Promise<AviatorTrialView | null> {
  const trial = await getTrialFromCookie()
  return trial ? toTrialView(trial) : null
}

export async function createTrialForEntry(entryId: string): Promise<AviatorTrialView> {
  const entry = await prisma.adminBetEntry.findUnique({
    where: { id: entryId },
    include: { slip: { select: { code: true } } },
  })

  if (!entry) {
    throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  }
  if (entry.status !== 'PAID') {
    throw new BetError(
      'The Aviator trial unlocks after the shared slip is paid.',
      409,
      'TRIAL_NOT_READY',
    )
  }

  let trial = await prisma.aviatorTrial.findUnique({ where: { entryId } })

  if (!trial) {
    const priorEntries = await prisma.adminBetEntry.findMany({
      where: { phone: entry.phone, id: { not: entry.id } },
      select: { id: true },
    })
    const priorTrial =
      (entry.userId
        ? await prisma.aviatorTrial.findFirst({
            where: { userId: entry.userId },
            orderBy: { createdAt: 'desc' },
          })
        : null) ??
      (priorEntries.length
        ? await prisma.aviatorTrial.findFirst({
            where: { entryId: { in: priorEntries.map(prior => prior.id) } },
            orderBy: { createdAt: 'desc' },
          })
        : null)

    if (priorTrial) {
      throw new BetError(
        'This phone number has already received the Aviator trial.',
        409,
        'TRIAL_ALREADY_GRANTED',
      )
    }
  }

  if (!trial) {
    try {
      trial = await prisma.aviatorTrial.create({
        data: {
          token: randomBytes(24).toString('hex'),
          entryId,
          shareCode: entry.slip.code,
          userId: entry.userId,
          stakeMinor: TRIAL_STAKE_MINOR,
          prizeMinor: TRIAL_PRIZE_MINOR,
        },
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
      trial = await prisma.aviatorTrial.findUnique({ where: { entryId } })
    }
  }

  if (!trial) {
    throw new BetError('The Aviator trial could not be created.', 500, 'TRIAL_CREATE_FAILED')
  }

  await setTrialCookie(trial.token)
  return toTrialView(trial)
}

export async function playTrial(): Promise<{
  trial: AviatorTrialView
  alreadyPlayed: boolean
}> {
  const trial = await getTrialFromCookie()
  if (!trial) {
    throw new BetError('Open a paid shared slip to start the Aviator trial.', 404, 'TRIAL_NOT_FOUND')
  }

  if (trial.status !== 'GRANTED') {
    return { trial: toTrialView(trial), alreadyPlayed: true }
  }

  const updated = await prisma.aviatorTrial.updateMany({
    where: { id: trial.id, status: 'GRANTED' },
    data: { status: 'PLAYED', playedAt: new Date() },
  })

  const next = updated.count
    ? await prisma.aviatorTrial.findUniqueOrThrow({ where: { id: trial.id } })
    : trial

  return { trial: toTrialView(next), alreadyPlayed: updated.count === 0 }
}

async function claimTrialInTransaction(
  tx: Prisma.TransactionClient,
  trial: AviatorTrial,
  userId: string,
): Promise<void> {
  if (trial.userId && trial.userId !== userId) {
    throw new BetError('This trial belongs to another account.', 409, 'TRIAL_OWNER_MISMATCH')
  }

  if (trial.status === 'PLAYED') {
    const claimed = await tx.aviatorTrial.updateMany({
      where: { id: trial.id, status: 'PLAYED', userId: trial.userId ?? null },
      data: { status: 'CLAIMED', userId, claimedAt: new Date() },
    })

    if (claimed.count > 0) {
      await creditWallet(tx, {
        userId,
        amountMinor: trial.prizeMinor,
        type: 'PROMO_BONUS',
        reference: `aviator-trial:${trial.id}:prize`,
        note: 'Aviator trial prize',
        metadata: { trialId: trial.id, source: 'aviator-trial' },
      })
    }
    return
  }

  if (trial.status === 'GRANTED' && !trial.userId) {
    await tx.aviatorTrial.updateMany({
      where: { id: trial.id, userId: null },
      data: { userId },
    })
  }
}

export async function claimTrialForUser(userId: string): Promise<AviatorTrialView | null> {
  const trial = await getTrialFromCookie()
  if (!trial) return null

  await prisma.$transaction(tx => claimTrialInTransaction(tx, trial, userId))
  const latest = await prisma.aviatorTrial.findUnique({ where: { id: trial.id } })
  return latest ? toTrialView(latest) : null
}

export async function getLatestTrialForUser(userId: string): Promise<AviatorTrialView | null> {
  const trial = await prisma.aviatorTrial.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return trial ? toTrialView(trial) : null
}

export async function requestTrialWithdrawal(
  userId: string,
  phoneInput: string,
): Promise<TrialWithdrawalResult> {
  const normalized = normalizeTzPhone(phoneInput)
  if (!normalized.ok) {
    throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'INVALID_PHONE')
  }

  const pending = await prisma.aviatorTrial.findFirst({
    where: { userId, withdrawalStatus: 'PENDING' },
    orderBy: { withdrawalRequestedAt: 'desc' },
  })

  if (pending) {
    return {
      trial: toTrialView(pending),
      wallet: await getWalletView(userId),
      alreadyRequested: true,
    }
  }

  const ready = await prisma.aviatorTrial.findFirst({
    where: {
      userId,
      status: { in: ['PLAYED', 'CLAIMED'] },
      withdrawalStatus: 'NONE',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!ready) {
    throw new BetError('There is no Aviator trial prize ready to withdraw.', 404, 'NO_TRIAL_PRIZE')
  }

  const now = new Date()
  const eta = new Date(now.getTime() + TRIAL_WITHDRAWAL_HOURS * 60 * 60 * 1000)

  const updated = await prisma.$transaction(async tx => {
    const current = await tx.aviatorTrial.findUniqueOrThrow({ where: { id: ready.id } })

    if (current.userId !== userId) {
      throw new BetError('This trial belongs to another account.', 409, 'TRIAL_OWNER_MISMATCH')
    }
    if (current.withdrawalStatus === 'PENDING') return current
    if (current.withdrawalStatus !== 'NONE') {
      throw new BetError('This trial prize has already been handled.', 409, 'TRIAL_ALREADY_WITHDRAWN')
    }

    if (current.status === 'PLAYED') {
      const claimed = await tx.aviatorTrial.updateMany({
        where: { id: current.id, status: 'PLAYED' },
        data: { status: 'CLAIMED', claimedAt: now },
      })

      if (claimed.count > 0) {
        await creditWallet(tx, {
          userId,
          amountMinor: current.prizeMinor,
          type: 'PROMO_BONUS',
          reference: `aviator-trial:${current.id}:prize`,
          note: 'Aviator trial prize',
          metadata: { trialId: current.id, source: 'aviator-trial' },
        })
      }
    }

    await debitWallet(tx, {
      userId,
      amountMinor: current.prizeMinor,
      type: 'WITHDRAWAL',
      reference: `aviator-trial:${current.id}:withdraw`,
      note: 'Aviator trial prize withdrawal',
      metadata: { trialId: current.id, phone: normalized.phone },
    })

    return tx.aviatorTrial.update({
      where: { id: current.id },
      data: {
        phone: normalized.phone,
        withdrawalStatus: 'PENDING',
        withdrawalRequestedAt: now,
        withdrawalEtaAt: eta,
      },
    })
  })

  return {
    trial: toTrialView(updated),
    wallet: await getWalletView(userId),
    alreadyRequested: false,
  }
}
