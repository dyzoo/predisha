import { json } from '@/lib/api'
import { handleBetError, isUniqueConstraintError } from '@/lib/bet/errors'
import { getBetMode } from '@/lib/bet/mode'
import { randomCode } from '@/lib/bet/random'
import { guardMutation, readJson, requireViewer } from '@/lib/bet/security'
import { withdrawSchema } from '@/lib/bet/validation'
import {
  debitWallet,
  findTransactionByReference,
  getWalletView,
} from '@/lib/bet/wallet'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    guardMutation(request, 'withdraw', 10, 60_000)
    const viewer = await requireViewer()
    const input = await readJson(request, withdrawSchema)
    const reference = input.reference ?? `wd:${viewer.userId}:${Date.now()}:${randomCode(6)}`
    const mode = await getBetMode()

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
        await debitWallet(tx, {
          userId: viewer.userId,
          amountMinor: input.amountMinor,
          type: 'WITHDRAWAL',
          reference,
          note: mode === 'LIVE' ? 'Withdrawal request' : 'Withdrawal',
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
