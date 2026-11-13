import { json } from '@/lib/api'
import { startWalletDeposit } from '@/lib/bet/deposits'
import { BetError, handleBetError, isUniqueConstraintError } from '@/lib/bet/errors'
import { getBetMode } from '@/lib/bet/mode'
import { randomCode } from '@/lib/bet/random'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { depositSchema } from '@/lib/bet/validation'
import {
  creditWallet,
  findTransactionByReference,
  getWalletView,
} from '@/lib/bet/wallet'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'deposit', 10, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, depositSchema)
    const mode = await getBetMode()

    if (mode === 'LIVE') {
      if (!input.phone) {
        throw new BetError(
          'Enter the mobile-money number that will approve the deposit.',
          422,
          'PHONE_REQUIRED',
        )
      }
      const order = await startWalletDeposit({
        userId: viewer.userId,
        amountMinor: input.amountMinor,
        phone: input.phone,
      })
      return json(
        {
          wallet: await getWalletView(viewer.userId),
          order,
          mode,
        },
        { status: 202 },
      )
    }

    const reference = input.reference ?? `dep:${viewer.userId}:${Date.now()}:${randomCode(6)}`

    const existing = await findTransactionByReference(reference)
    if (existing) {
      return json({
        wallet: await getWalletView(viewer.userId),
        duplicate: true,
        mode,
      })
    }

    try {
      await prisma.$transaction(async tx => {
        await creditWallet(tx, {
          userId: viewer.userId,
          amountMinor: input.amountMinor,
          type: 'DEPOSIT',
          reference,
          note: 'Deposit',
          metadata: { mode, source: 'manual' },
        })
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return json({
          wallet: await getWalletView(viewer.userId),
          duplicate: true,
          mode,
        })
      }
      throw error
    }

    return json({
      wallet: await getWalletView(viewer.userId),
      duplicate: false,
      mode,
    })
  } catch (error) {
    return handleBetError(error)
  }
}
