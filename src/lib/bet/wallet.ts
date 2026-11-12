import { Prisma, type BetTransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BetError } from './errors'
import type { BetTransactionView, BetWalletView } from './types'

export async function ensureWallet(userId: string) {
  return prisma.betWallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

function toTransactionView(transaction: {
  id: string
  type: string
  amountMinor: number
  balanceAfterMinor: number
  note: string | null
  createdAt: Date
}): BetTransactionView {
  return {
    id: transaction.id,
    type: transaction.type,
    amountMinor: transaction.amountMinor,
    balanceAfterMinor: transaction.balanceAfterMinor,
    note: transaction.note,
    createdAt: transaction.createdAt.toISOString(),
  }
}

export async function getWalletView(userId: string): Promise<BetWalletView> {
  const wallet = await ensureWallet(userId)
  const transactions = await prisma.betTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return {
    balanceMinor: wallet.balanceMinor,
    currency: 'TZS',
    sandbox: true,
    transactions: transactions.map(toTransactionView),
  }
}

export async function findTransactionByReference(reference: string) {
  return prisma.betTransaction.findUnique({ where: { reference } })
}

interface WalletMutation {
  userId: string
  amountMinor: number
  type: BetTransactionType
  reference?: string
  note?: string
  metadata?: Prisma.InputJsonValue
}

export async function creditWallet(
  tx: Prisma.TransactionClient,
  params: WalletMutation,
): Promise<{ balanceMinor: number }> {
  if (!Number.isInteger(params.amountMinor) || params.amountMinor <= 0) {
    throw new BetError('Credit amount must be a positive whole number.', 422, 'BAD_AMOUNT')
  }

  const wallet = await tx.betWallet.upsert({
    where: { userId: params.userId },
    update: { balanceMinor: { increment: params.amountMinor } },
    create: { userId: params.userId, balanceMinor: params.amountMinor },
  })

  await tx.betTransaction.create({
    data: {
      userId: params.userId,
      walletId: wallet.id,
      type: params.type,
      amountMinor: params.amountMinor,
      balanceAfterMinor: wallet.balanceMinor,
      reference: params.reference,
      note: params.note,
      metadata: params.metadata,
    },
  })

  return { balanceMinor: wallet.balanceMinor }
}

export async function debitWallet(
  tx: Prisma.TransactionClient,
  params: WalletMutation,
): Promise<{ balanceMinor: number }> {
  if (!Number.isInteger(params.amountMinor) || params.amountMinor <= 0) {
    throw new BetError('Debit amount must be a positive whole number.', 422, 'BAD_AMOUNT')
  }

  const updated = await tx.betWallet.updateMany({
    where: { userId: params.userId, balanceMinor: { gte: params.amountMinor } },
    data: { balanceMinor: { decrement: params.amountMinor } },
  })

  if (updated.count === 0) {
    const existing = await tx.betWallet.findUnique({ where: { userId: params.userId } })
    throw new BetError(
      'Not enough sandbox balance. Add sandbox funds first.',
      422,
      'INSUFFICIENT_FUNDS',
      { balanceMinor: existing?.balanceMinor ?? 0 },
    )
  }

  const wallet = await tx.betWallet.findUniqueOrThrow({ where: { userId: params.userId } })
  await tx.betTransaction.create({
    data: {
      userId: params.userId,
      walletId: wallet.id,
      type: params.type,
      amountMinor: -params.amountMinor,
      balanceAfterMinor: wallet.balanceMinor,
      reference: params.reference,
      note: params.note,
      metadata: params.metadata,
    },
  })

  return { balanceMinor: wallet.balanceMinor }
}
