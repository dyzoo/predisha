import { Prisma, type BetWinnerSlip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateTicketCode } from './bets'
import { BetError } from './errors'
import { formatKickoffLabel } from './format'
import { combineOdds } from './odds'
import { randomCode } from './random'
import {
  MAX_SELECTIONS,
  MAX_STAKE_MINOR,
  MIN_STAKE_MINOR,
  type TicketSelection,
} from './types'
import { applyVat, VAT_PERCENT } from './vat'
import { creditWallet } from './wallet'

const MAX_TOTAL_ODDS = 1_000_000
const MAX_GROSS_PAYOUT_MINOR = 1_000_000_000

export interface WinnerSelectionInput {
  fixtureId?: string
  fixtureLabel: string
  competition?: string
  marketId?: string
  marketName: string
  selectionId?: string
  selectionLabel: string
  odds: number
  finalScore?: { home: number; away: number } | null
  kickoffIso?: string
}

export interface WinnerSlipView {
  id: string
  code: string
  title: string | null
  userId: string
  userName: string | null
  userEmail: string
  stakeMinor: number
  totalOdds: number
  grossPayoutMinor: number
  vatMinor: number
  netPayoutMinor: number
  selections: TicketSelection[]
  ticketId: string | null
  ticketCode: string | null
  creditedAt: string | null
  createdAt: string
}

export interface PublicWinnerSlipView {
  id: string
  code: string
  title: string | null
  recipientName: string
  stakeMinor: number
  totalOdds: number
  grossPayoutMinor: number
  vatMinor: number
  netPayoutMinor: number
  selections: TicketSelection[]
  ticketCode: string | null
  creditedAt: string | null
  createdAt: string
}

interface WinnerUser {
  id: string
  name: string | null
  email: string
}

function parseSelections(value: Prisma.JsonValue): TicketSelection[] {
  if (!Array.isArray(value)) return []
  return value as unknown as TicketSelection[]
}

function roundOdds(value: number): number {
  return Math.round(value * 100) / 100
}

function buildWinnerSelections(
  selections: WinnerSelectionInput[],
  now: Date,
): TicketSelection[] {
  return selections.map((selection, index) => {
    const odds = roundOdds(selection.odds)
    const kickoffIso = selection.kickoffIso ?? now.toISOString()
    return {
      fixtureId: selection.fixtureId?.trim() || `winner-${index + 1}`,
      fixtureLabel: selection.fixtureLabel.trim(),
      competition: selection.competition?.trim() || 'Admin-settled winner',
      kickoffIso,
      kickoffLabel: formatKickoffLabel(kickoffIso),
      marketId: selection.marketId?.trim() || 'winner',
      marketName: selection.marketName.trim(),
      selectionId: selection.selectionId?.trim() || `WINNER_${index + 1}`,
      selectionLabel: selection.selectionLabel.trim(),
      odds,
      probability: Math.min(0.999, Math.max(0.001, 1 / odds)),
      result: 'WON',
      finalScore: selection.finalScore ?? null,
      demoResult: false,
    }
  })
}

function toWinnerView(
  slip: BetWinnerSlip & { user: WinnerUser },
  ticketCode: string | null,
): WinnerSlipView {
  return {
    id: slip.id,
    code: slip.code,
    title: slip.title,
    userId: slip.userId,
    userName: slip.user.name,
    userEmail: slip.user.email,
    stakeMinor: slip.stakeMinor,
    totalOdds: slip.totalOdds,
    grossPayoutMinor: slip.grossPayoutMinor,
    vatMinor: slip.vatMinor,
    netPayoutMinor: slip.netPayoutMinor,
    selections: parseSelections(slip.selections),
    ticketId: slip.ticketId,
    ticketCode,
    creditedAt: slip.creditedAt?.toISOString() ?? null,
    createdAt: slip.createdAt.toISOString(),
  }
}

async function generateWinnerCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(6)
    const [winner, admin, share] = await Promise.all([
      prisma.betWinnerSlip.findUnique({ where: { code }, select: { id: true } }),
      prisma.adminBetSlip.findUnique({ where: { code }, select: { id: true } }),
      prisma.betShareCode.findUnique({ where: { code }, select: { id: true } }),
    ])
    if (!winner && !admin && !share) return code
  }
  throw new BetError('Could not generate a winner slip code. Please try again.', 503, 'CODE_UNAVAILABLE')
}

export async function createWinnerSlip(input: {
  userId: string
  title?: string | null
  stakeMinor: number
  selections: WinnerSelectionInput[]
  note?: string | null
  createdBy: string
  now?: Date
}): Promise<WinnerSlipView> {
  const now = input.now ?? new Date()

  if (!Number.isInteger(input.stakeMinor)) {
    throw new BetError('Stake must be a whole amount.', 422, 'BAD_STAKE')
  }
  if (input.stakeMinor < MIN_STAKE_MINOR || input.stakeMinor > MAX_STAKE_MINOR) {
    throw new BetError(
      `Stake must be between ${MIN_STAKE_MINOR} and ${MAX_STAKE_MINOR} TZS.`,
      422,
      'BAD_STAKE',
    )
  }
  if (input.selections.length === 0) {
    throw new BetError('Add at least one winning selection.', 422, 'EMPTY_SLIP')
  }
  if (input.selections.length > MAX_SELECTIONS) {
    throw new BetError(
      `A winner slip can hold at most ${MAX_SELECTIONS} selections.`,
      422,
      'TOO_MANY_SELECTIONS',
    )
  }
  for (const selection of input.selections) {
    if (!Number.isFinite(selection.odds) || selection.odds < 1.01 || selection.odds > 1000) {
      throw new BetError('Odds must be between 1.01 and 1000.', 422, 'BAD_ODDS')
    }
  }

  const selections = buildWinnerSelections(input.selections, now)
  const totalOdds = combineOdds(selections.map(selection => selection.odds))
  if (!Number.isFinite(totalOdds) || totalOdds > MAX_TOTAL_ODDS) {
    throw new BetError('Combined odds are too large. Reduce the number of selections.', 422, 'ODDS_TOO_HIGH')
  }

  const grossPayoutMinor = Math.floor(input.stakeMinor * totalOdds)
  if (grossPayoutMinor > MAX_GROSS_PAYOUT_MINOR) {
    throw new BetError('This payout is too large. Reduce the stake or the odds.', 422, 'PAYOUT_TOO_HIGH')
  }
  const vat = applyVat(grossPayoutMinor)

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    throw new BetError('Choose a registered user for this winner slip.', 404, 'USER_NOT_FOUND')
  }

  const code = await generateWinnerCode()
  const ticketCode = await generateTicketCode()

  try {
    const created = await prisma.$transaction(async tx => {
      const slip = await tx.betWinnerSlip.create({
        data: {
          code,
          userId: user.id,
          title: input.title?.trim().slice(0, 120) || null,
          selections: selections as unknown as Prisma.InputJsonValue,
          stakeMinor: input.stakeMinor,
          totalOdds,
          grossPayoutMinor: vat.grossMinor,
          vatMinor: vat.vatMinor,
          netPayoutMinor: vat.netPayoutMinor,
          createdBy: input.createdBy,
          creditedAt: now,
        },
      })

      const ticket = await tx.betTicket.create({
        data: {
          userId: user.id,
          code: ticketCode,
          stakeMinor: input.stakeMinor,
          totalOdds,
          potentialReturnMinor: vat.grossMinor,
          status: 'WON',
          payoutMinor: vat.netPayoutMinor,
          selectionCount: selections.length,
          selections: selections as unknown as Prisma.InputJsonValue,
          placedAt: now,
          settledAt: now,
        },
      })

      await creditWallet(tx, {
        userId: user.id,
        amountMinor: vat.netPayoutMinor,
        type: 'BET_WIN',
        reference: `winner:${code}:payout`,
        note: `Winner payout ${code} (${VAT_PERCENT}% VAT deducted)`,
        metadata: {
          winnerSlipId: slip.id,
          ticketId: ticket.id,
          ticketCode: ticket.code,
          stakeMinor: input.stakeMinor,
          totalOdds,
          grossPayoutMinor: vat.grossMinor,
          vatMinor: vat.vatMinor,
          vatPercent: VAT_PERCENT,
        },
      })

      const updated = await tx.betWinnerSlip.update({
        where: { id: slip.id },
        data: { ticketId: ticket.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      })

      await tx.adminAuditLog.create({
        data: {
          actorId: input.createdBy,
          action: 'admin.winner.create',
          target: code,
          metadata: {
            userId: user.id,
            userEmail: user.email,
            ticketId: ticket.id,
            ticketCode: ticket.code,
            stakeMinor: input.stakeMinor,
            totalOdds,
            grossPayoutMinor: vat.grossMinor,
            vatMinor: vat.vatMinor,
            netPayoutMinor: vat.netPayoutMinor,
            creditedAt: now.toISOString(),
            note: input.note?.trim() || null,
          },
        },
      })

      return toWinnerView(updated, ticket.code)
    })

    return created
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const codeValue = (error as { code?: unknown }).code
      if (codeValue === 'P2002') {
        throw new BetError('Could not generate a unique winner slip. Please try again.', 409, 'DUPLICATE_CODE')
      }
    }
    throw error
  }
}

export async function listWinnerSlips(limit = 20): Promise<WinnerSlipView[]> {
  const slips = await prisma.betWinnerSlip.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  const ticketIds = slips
    .map(slip => slip.ticketId)
    .filter((id): id is string => Boolean(id))
  const tickets =
    ticketIds.length > 0
      ? await prisma.betTicket.findMany({
          where: { id: { in: ticketIds } },
          select: { id: true, code: true },
        })
      : []
  const codeByTicket = new Map(
    tickets.map(ticket => [ticket.id, ticket.code] as const),
  )

  return slips.map(slip =>
    toWinnerView(
      slip,
      slip.ticketId ? codeByTicket.get(slip.ticketId) ?? null : null,
    ),
  )
}

export async function getWinnerSlipByCode(code: string): Promise<WinnerSlipView> {
  const normalized = code.trim().toUpperCase()
  const slip = await prisma.betWinnerSlip.findUnique({
    where: { code: normalized },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!slip) {
    throw new BetError('That winner slip does not exist.', 404, 'WINNER_NOT_FOUND')
  }
  const ticket = slip.ticketId
    ? await prisma.betTicket.findUnique({
        where: { id: slip.ticketId },
        select: { code: true },
      })
    : null
  return toWinnerView(slip, ticket?.code ?? null)
}

export function toPublicWinnerView(view: WinnerSlipView): PublicWinnerSlipView {
  return {
    id: view.id,
    code: view.code,
    title: view.title,
    recipientName: view.userName?.trim().split(/\s+/)[0] || 'Winner',
    stakeMinor: view.stakeMinor,
    totalOdds: view.totalOdds,
    grossPayoutMinor: view.grossPayoutMinor,
    vatMinor: view.vatMinor,
    netPayoutMinor: view.netPayoutMinor,
    selections: view.selections,
    ticketCode: view.ticketCode,
    creditedAt: view.creditedAt,
    createdAt: view.createdAt,
  }
}
