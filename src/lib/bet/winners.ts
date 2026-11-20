import { Prisma, type BetWinnerSlip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateTicketCode } from './bets'
import { BetError } from './errors'
import { formatKickoffLabel } from './format'
import { combineOdds } from './odds'
import { randomCode } from './random'
import { toAdminSlipView } from './slips'
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

export interface WinnerSlipSourceView {
  id: string
  code: string
  title: string | null
  status: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  inPlay: boolean
  matchLabel: string | null
  selectionCount: number
  entryCount: number
  createdAt: string
  selections: TicketSelection[]
}

export interface WinnerTicketSourceView {
  id: string
  code: string
  userId: string
  userName: string | null
  userEmail: string
  slipCode: string | null
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  placedAt: string
  selections: TicketSelection[]
}

export interface ActiveWinnerSources {
  slips: WinnerSlipSourceView[]
  tickets: WinnerTicketSourceView[]
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
  sourceSlipId?: string | null
  sourceEntryId?: string | null
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

  const sourceSlip = input.sourceSlipId
    ? await prisma.adminBetSlip.findUnique({ where: { id: input.sourceSlipId } })
    : null
  if (input.sourceSlipId && !sourceSlip) {
    throw new BetError('That shared slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  const sourceEntry = input.sourceEntryId
    ? await prisma.adminBetEntry.findUnique({ where: { id: input.sourceEntryId } })
    : null
  if (input.sourceEntryId && !sourceEntry) {
    throw new BetError('That shared-bet entry does not exist.', 404, 'ENTRY_NOT_FOUND')
  }
  if (sourceEntry && sourceEntry.status !== 'PAID') {
    throw new BetError('Only paid entries can be assigned as winners.', 409, 'ENTRY_NOT_PAID')
  }
  if (sourceEntry && sourceEntry.userId !== user.id) {
    throw new BetError('That entry belongs to a different user.', 409, 'ENTRY_USER_MISMATCH')
  }
  if (sourceEntry && sourceEntry.ticketId) {
    throw new BetError('That entry already has a ticket.', 409, 'ENTRY_HAS_TICKET')
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

      if (sourceEntry) {
        await tx.adminBetEntry.update({
          where: { id: sourceEntry.id },
          data: { ticketId: ticket.id, status: 'PAID' },
        })
      }

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
          sourceSlipId: sourceSlip?.id ?? null,
          sourceSlipCode: sourceSlip?.code ?? null,
          sourceEntryId: sourceEntry?.id ?? null,
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
            sourceSlipId: sourceSlip?.id ?? null,
            sourceSlipCode: sourceSlip?.code ?? null,
            sourceSlipStatus: sourceSlip?.status ?? null,
            sourceEntryId: sourceEntry?.id ?? null,
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

export async function assignAdminSlipEntryWin(input: {
  entryId: string
  createdBy: string
  now?: Date
}): Promise<WinnerSlipView> {
  const now = input.now ?? new Date()
  const entry = await prisma.adminBetEntry.findUnique({
    where: { id: input.entryId.trim() },
    include: {
      slip: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })
  if (!entry) {
    throw new BetError('That shared-bet entry does not exist.', 404, 'ENTRY_NOT_FOUND')
  }
  if (entry.status !== 'PAID') {
    throw new BetError('Only paid entries can be assigned as winners.', 409, 'ENTRY_NOT_PAID')
  }
  if (!entry.userId || !entry.user) {
    throw new BetError('This entry has no registered user to credit.', 422, 'ENTRY_NO_USER')
  }
  const ticket = entry.ticketId
    ? await prisma.betTicket.findUnique({
        where: { id: entry.ticketId },
        select: { id: true, code: true, status: true },
      })
    : null

  if (entry.ticketId) {
    const existing = await prisma.betWinnerSlip.findUnique({
      where: { ticketId: entry.ticketId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (existing) {
      return toWinnerView(existing, ticket?.code ?? null)
    }
    if (ticket?.status !== 'OPEN') {
      throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
    }
    return createWinnerFromTicket({
      ticketId: entry.ticketId,
      title: entry.slip.title ?? `Winner · ${entry.slip.code}`,
      note: `Assigned from shared slip ${entry.slip.code}`,
      createdBy: input.createdBy,
      now,
    })
  }

  return createWinnerSlip({
    userId: entry.userId,
    title: entry.slip.title ?? `Winner · ${entry.slip.code}`,
    stakeMinor: entry.stakeMinor,
    selections: parseSelections(entry.slip.selections),
    note: `Assigned from shared slip ${entry.slip.code}`,
    createdBy: input.createdBy,
    now,
    sourceSlipId: entry.slip.id,
    sourceEntryId: entry.id,
  })
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

export async function listActiveWinnerSources(
  now: Date = new Date(),
): Promise<ActiveWinnerSources> {
  const [slipRecords, ticketRecords] = await Promise.all([
    prisma.adminBetSlip.findMany({
      where: { status: { in: ['OPEN', 'FROZEN'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.betTicket.findMany({
      where: { status: 'OPEN' },
      orderBy: { placedAt: 'desc' },
      take: 40,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  const slipIds = slipRecords.map(slip => slip.id)
  const entries =
    slipIds.length > 0
      ? await prisma.adminBetEntry.findMany({
          where: { slipId: { in: slipIds } },
          select: { slipId: true },
        })
      : []
  const entryCounts = new Map<string, number>()
  for (const entry of entries) {
    entryCounts.set(entry.slipId, (entryCounts.get(entry.slipId) ?? 0) + 1)
  }

  const slips: WinnerSlipSourceView[] = slipRecords.map(record => {
    const view = toAdminSlipView(record, now)
    return {
      id: record.id,
      code: record.code,
      title: record.title,
      status: record.status,
      stakeMinor: record.stakeMinor,
      totalOdds: view.quote.totalOdds,
      potentialReturnMinor: view.quote.potentialReturnMinor,
      inPlay: view.inPlay,
      matchLabel: view.matchClock?.label ?? null,
      selectionCount: view.selections.length,
      entryCount: entryCounts.get(record.id) ?? 0,
      createdAt: record.createdAt.toISOString(),
      selections: view.selections,
    }
  })

  const ticketIds = ticketRecords.map(ticket => ticket.id)
  const shareEntries =
    ticketIds.length > 0
      ? await prisma.adminBetEntry.findMany({
          where: { ticketId: { in: ticketIds } },
          select: { ticketId: true, slip: { select: { code: true } } },
        })
      : []
  const slipCodeByTicket = new Map(
    shareEntries
      .filter(entry => entry.ticketId)
      .map(entry => [entry.ticketId as string, entry.slip.code] as const),
  )

  const tickets: WinnerTicketSourceView[] = ticketRecords.map(ticket => ({
    id: ticket.id,
    code: ticket.code,
    userId: ticket.userId,
    userName: ticket.user.name,
    userEmail: ticket.user.email,
    slipCode: slipCodeByTicket.get(ticket.id) ?? null,
    stakeMinor: ticket.stakeMinor,
    totalOdds: ticket.totalOdds,
    potentialReturnMinor: ticket.potentialReturnMinor,
    placedAt: ticket.placedAt.toISOString(),
    selections: parseSelections(ticket.selections),
  }))

  return { slips, tickets }
}

export async function createWinnerFromTicket(input: {
  ticketId: string
  title?: string | null
  note?: string | null
  createdBy: string
  now?: Date
}): Promise<WinnerSlipView> {
  const now = input.now ?? new Date()
  const ticket = await prisma.betTicket.findUnique({
    where: { id: input.ticketId.trim() },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!ticket) {
    throw new BetError('That ticket does not exist.', 404, 'TICKET_NOT_FOUND')
  }

  const existing = await prisma.betWinnerSlip.findUnique({
    where: { ticketId: ticket.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (existing) {
    return toWinnerView(existing, ticket.code)
  }
  if (ticket.status !== 'OPEN') {
    throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
  }

  const selections = parseSelections(ticket.selections).map(selection => ({
    ...selection,
    result: 'WON' as const,
  }))
  if (selections.length === 0) {
    throw new BetError('This ticket has no selections to settle.', 422, 'EMPTY_TICKET')
  }

  const vat = applyVat(ticket.potentialReturnMinor)
  const code = await generateWinnerCode()

  return prisma.$transaction(async tx => {
    const updated = await tx.betTicket.updateMany({
      where: { id: ticket.id, status: 'OPEN' },
      data: {
        status: 'WON',
        payoutMinor: vat.netPayoutMinor,
        settledAt: now,
        selections: selections as unknown as Prisma.InputJsonValue,
      },
    })
    if (updated.count === 0) {
      throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
    }

    const slip = await tx.betWinnerSlip.create({
      data: {
        code,
        userId: ticket.userId,
        title: input.title?.trim().slice(0, 120) || null,
        selections: selections as unknown as Prisma.InputJsonValue,
        stakeMinor: ticket.stakeMinor,
        totalOdds: ticket.totalOdds,
        grossPayoutMinor: vat.grossMinor,
        vatMinor: vat.vatMinor,
        netPayoutMinor: vat.netPayoutMinor,
        ticketId: ticket.id,
        createdBy: input.createdBy,
        creditedAt: now,
      },
    })

    await creditWallet(tx, {
      userId: ticket.userId,
      amountMinor: vat.netPayoutMinor,
      type: 'BET_WIN',
      reference: `winner:${code}:payout`,
      note: `Winner payout ${code} (${VAT_PERCENT}% VAT deducted)`,
      metadata: {
        winnerSlipId: slip.id,
        ticketId: ticket.id,
        ticketCode: ticket.code,
        stakeMinor: ticket.stakeMinor,
        totalOdds: ticket.totalOdds,
        grossPayoutMinor: vat.grossMinor,
        vatMinor: vat.vatMinor,
        vatPercent: VAT_PERCENT,
      },
    })

    await tx.adminAuditLog.create({
      data: {
        actorId: input.createdBy,
        action: 'admin.winner.create-from-ticket',
        target: code,
        metadata: {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          userId: ticket.userId,
          userEmail: ticket.user.email,
          stakeMinor: ticket.stakeMinor,
          totalOdds: ticket.totalOdds,
          grossPayoutMinor: vat.grossMinor,
          vatMinor: vat.vatMinor,
          netPayoutMinor: vat.netPayoutMinor,
          creditedAt: now.toISOString(),
          note: input.note?.trim() || null,
        },
      },
    })

    return toWinnerView(
      { ...slip, user: ticket.user },
      ticket.code,
    )
  })
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
