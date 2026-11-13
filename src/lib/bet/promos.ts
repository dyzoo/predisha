import { prisma } from '@/lib/prisma'
import { BetError, isUniqueConstraintError } from './errors'
import { creditWallet, getWalletView } from './wallet'
import type { BetMode } from './mode-copy'
import type { BetPromoView, BetWalletView } from './types'

interface PromoDefinition {
  id: string
  bonusMinor: number
}

export const PROMOS: PromoDefinition[] = [
  { id: 'welcome', bonusMinor: 2_000 },
  { id: 'weekend', bonusMinor: 5_000 },
  { id: 'games', bonusMinor: 1_000 },
]

function promoCopy(mode: BetMode, id: string): { title: string; description: string } {
  switch (id) {
    case 'welcome':
      if (mode === 'SANDBOX') {
        return { title: 'Welcome play-money bonus', description: 'A one-off 2,000 TZS play-money boost for new accounts.' }
      }
      return { title: 'Welcome bonus', description: 'A one-off 2,000 TZS bonus credited to your betting wallet.' }
    case 'weekend':
      if (mode === 'SANDBOX') {
        return { title: 'Weekend play-money boost', description: 'Claim 5,000 TZS in play-money funds. No deposit required.' }
      }
      return { title: 'Weekend bonus', description: 'Claim 5,000 TZS in bonus funds. No deposit required.' }
    case 'games':
      if (mode === 'SANDBOX') {
        return { title: 'Games arcade credit', description: '1,000 TZS of play-money credit for Aviator, Mines and the arcade games.' }
      }
      return { title: 'Arcade credit', description: '1,000 TZS of bonus credit for Aviator, Mines and the arcade games.' }
    default:
      return { title: 'Bonus', description: 'A bonus for your account.' }
  }
}

export async function listPromos(userId?: string, mode: BetMode = 'LIVE'): Promise<BetPromoView[]> {
  const claims = userId
    ? await prisma.betPromoClaim.findMany({ where: { userId } })
    : []
  const claimsById = new Map(claims.map(claim => [claim.promoId, claim]))

  return PROMOS.map(promo => {
    const claim = claimsById.get(promo.id)
    const copy = promoCopy(mode, promo.id)
    return {
      id: promo.id,
      title: copy.title,
      description: copy.description,
      bonusMinor: promo.bonusMinor,
      claimed: Boolean(claim),
      claimedAt: claim?.claimedAt.toISOString() ?? null,
    }
  })
}

export async function claimPromo(
  userId: string,
  promoId: string,
  mode: BetMode = 'LIVE',
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
        data: {
          userId,
          promoId,
          bonusMinor: promo.bonusMinor,
        },
      })
      await creditWallet(tx, {
        userId,
        amountMinor: promo.bonusMinor,
        type: 'PROMO_BONUS',
        reference: `promo:${promoId}:${userId}`,
        note: promoCopy(mode, promoId).title,
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BetError('You already claimed this promo.', 409, 'PROMO_CLAIMED')
    }
    throw error
  }

  const promoView: BetPromoView = {
    id: promo.id,
    ...promoCopy(mode, promo.id),
    bonusMinor: promo.bonusMinor,
    claimed: true,
    claimedAt: new Date().toISOString(),
  }

  return {
    wallet: await getWalletView(userId),
    promo: promoView,
  }
}