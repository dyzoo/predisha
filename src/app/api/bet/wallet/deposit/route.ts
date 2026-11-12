import { json } from '@/lib/api'
import { handleBetError, isUniqueConstraintError } from '@/lib/bet/errors'
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
    const reference = input.reference ?? `dep:${viewer.userId}:${Date.now()}:${randomCode(6)}`

    const existing = await findTransactionByReference(reference)
    if (existing) {
      return json({
        wallet: await getWalletView(viewer.userId),
        duplicate: true,
        sandbox: true,
      })
    }

    try {
      await prisma.$transaction(async tx => {
        await creditWallet(tx, {
          userId: viewer.userId,
          amountMinor: input.amountMinor,
          type: 'DEPOSIT',
          reference,
          note: 'Sandbox deposit',
          metadata: { sandbox: true, source: 'manual' },
        })
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return json({
          wallet: await getWalletView(viewer.userId),
          duplicate: true,
          sandbox: true,
        })
      }
      throw error
    }

    return json({
      wallet: await getWalletView(viewer.userId),
      duplicate: false,
      sandbox: true,
    })
  } catch (error) {
    return handleBetError(error)
  }
}
