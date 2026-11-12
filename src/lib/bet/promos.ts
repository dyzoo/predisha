import { prisma } from '@/lib/prisma'
import { BetError, isUniqueConstraintError } from './errors'
import { creditWallet, getWalletView } from './wallet'
import type { BetPromoView, BetWalletView } from './types'

interface PromoDefinition {
  id: string
  title: string
  description: string
  bonusMinor: number
}

export const PROMOS: PromoDefinition[] = [
  {
    id: 'welcome-sandbox',
    title: 'Sandbox welcome bonus',
    description: 'A one-off 2,000 TZS play-money boost for new sandbox accounts.',
    bonusMinor: 2_000,
  },
  {
    id: 'weekend-sandbox',
    title: 'Weekend play-money boost',
    description: 'Claim 5,000 TZS in sandbox funds. No deposit, no cash value.',
    bonusMinor: 5_000,
  },
  {
    id: 'games-sandbox',
    title: 'Games arcade credit',
    description: '1,000 TZS of sandbox credit for Aviator, Mines and the arcade games.',
    bonusMinor: 1_000,
  },
]

export async function listPromos(userId?: string): Promise<BetPromoView[]> {
  const claims = userId
    ? await prisma.betPromoClaim.findMany({ where: { userId } })
    : []
  const claimsById = new Map(claims.map(claim => [claim.promoId, claim]))

  return PROMOS.map(promo => {
    const claim = claimsById.get(promo.id)
    return {
      ...promo,
      claimed: Boolean(claim),
      claimedAt: claim?.claimedAt.toISOString() ?? null,
    }
  })
}

export async function claimPromo(
  userId: string,
  promoId: string,
): Promise<{ wallet: BetWalletView; promo: BetPromoView }> {
  const promo = PROMOS.find(item => item.id === promoId)
  if (!promo) throw new BetError('That promo does not exist.', 404, 'PROMO_NOT_FOUND')

  try {
    await prisma.$transaction(async tx => {
      const existing = await tx.betPromoClaim.findUnique({
        where: { userId_promoId: { userId, promoId } },
      })
      if (existing) {
        throw new BetError('You already claimed this promo.', 409, 'PROMO_CLAIMED')
      }

      await tx.betPromoClaim.create({
        data: { userId, promoId, bonusMinor: promo.bonusMinor },
      })
      await creditWallet(tx, {
        userId,
        amountMinor: promo.bonusMinor,
        type: 'PROMO_BONUS',
        reference: `promo:${promoId}:${userId}`,
        note: promo.title,
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BetError('You already claimed this promo.', 409, 'PROMO_CLAIMED')
    }
    throw error
  }

  return {
    wallet: await getWalletView(userId),
    promo: {
      ...promo,
      claimed: true,
      claimedAt: new Date().toISOString(),
    },
  }
}
