import { json } from '@/lib/api'
import { BetError, handleBetError, isUniqueConstraintError } from '@/lib/bet/errors'
import { getBetMode } from '@/lib/bet/mode'
import { maskTzPhone, normalizeTzPhone } from '@/lib/bet/phone'
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
    const normalized = normalizeTzPhone(input.phone)
    if (!normalized.ok) {
      throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'BAD_PHONE')
    }
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
          note: `Transfer to ${maskTzPhone(normalized.phone)}`,
          metadata: {
            mode,
            source: 'mobile-transfer',
            phone: normalized.phone,
            status: 'PROCESSING',
          },
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
      transfer: {
        phoneMasked: maskTzPhone(normalized.phone),
        amountMinor: input.amountMinor,
        status: 'PROCESSING',
      },
    })
  } catch (error) {
    return handleBetError(error)
  }
}
