import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildSnapshot } from './bets'
import { getBetCatalog } from './catalog'
import { BetError, isUniqueConstraintError } from './errors'
import { findSelection } from './odds'
import { randomCode } from './random'
import { SHARE_CODE_HOURS, type BetSelectionInput, type TicketSelection } from './types'

export interface ShareCodeView {
  code: string
  selections: TicketSelection[]
  expiresAt: string
  stale: boolean
}

export async function createShareCode(
  userId: string,
  input: { selections: BetSelectionInput[] },
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: string; url: string }> {
  const catalog = await getBetCatalog(now)
  const selections = buildSnapshot(input.selections, catalog.events, now)
  const expiresAt = new Date(now.getTime() + SHARE_CODE_HOURS * 60 * 60 * 1000)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(6)
    try {
      await prisma.betShareCode.create({
        data: {
          code,
          selections: selections as unknown as Prisma.InputJsonValue,
          createdBy: userId,
          expiresAt,
        },
      })
      return { code, expiresAt: expiresAt.toISOString(), url: `/bet/share/${code}` }
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
    }
  }

  throw new BetError('Could not create a share code. Please try again.', 503, 'CODE_UNAVAILABLE')
}

export async function loadShareCode(
  code: string,
  now: Date = new Date(),
): Promise<ShareCodeView> {
  const record = await prisma.betShareCode.findUnique({ where: { code } })
  if (!record) {
    throw new BetError('That share code does not exist.', 404, 'SHARE_NOT_FOUND')
  }
  if (record.expiresAt.getTime() <= now.getTime()) {
    throw new BetError('That share code has expired.', 410, 'SHARE_EXPIRED')
  }

  const selections = Array.isArray(record.selections)
    ? (record.selections as unknown as TicketSelection[])
    : []
  const catalog = await getBetCatalog(now)
  const eventById = new Map(catalog.events.map(event => [event.id, event]))

  const stale = selections.some(selection => {
    const event = eventById.get(selection.fixtureId)
    if (!event) return true
    const option = findSelection(event, selection.marketId, selection.selectionId)
    if (!option) return true
    return Math.abs(option.odds - selection.odds) > 0.02
  })

  return {
    code: record.code,
    selections,
    expiresAt: record.expiresAt.toISOString(),
    stale,
  }
}
