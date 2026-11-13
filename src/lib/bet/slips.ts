import { Prisma, type AdminBetSlip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  computeTicketTotals,
  generateTicketCode,
  insertTicket,
  toTicketView,
  type TicketDraft,
} from './bets'
import { getBetCatalog } from './catalog'
import { BetError, isUniqueConstraintError } from './errors'
import { formatKickoffLabel } from './format'
import { randomCode } from './random'
import { getBetMode, type BetMode } from './mode'
import {
  MAX_SELECTIONS,
  MAX_STAKE_MINOR,
  MIN_STAKE_MINOR,
  type BetTicketView,
  type TicketSelection,
} from './types'

export type AdminBetSlipStatusView = 'OPEN' | 'FROZEN' | 'CLOSED'

export interface AdminSlipSelectionInput {
  fixtureId: string
  marketId: string
  selectionId: string
  odds: number
}

export interface AdminBetSlipView {
  id: string
  code: string
  title: string | null
  mode: BetMode
  status: AdminBetSlipStatusView
  frozen: boolean
  frozenReason: string | null
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  selections: TicketSelection[]
}

export interface AdminBetEntryView {
  id: string
  phoneMasked: string
  stakeMinor: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
  providerOrderId: string | null
  ticketId: string | null
  ticketCode: string | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
}

export interface AdminBetSlipListItem extends AdminBetSlipView {
  entryCount: number
  paidCount: number
  entries: AdminBetEntryView[]
}

const ACTIVE_ENTRY_STATUSES = new Set(['PENDING', 'PAID'])

function parseSelections(value: Prisma.JsonValue): TicketSelection[] {
  if (!Array.isArray(value)) return []
  return value as unknown as TicketSelection[]
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  return `${digits.slice(0, 5)}•••${digits.slice(-2)}`
}

export function isSlipFrozen(slip: Pick<AdminBetSlip, 'status' | 'autoFreezeAt'>, now = new Date()): boolean {
  return slip.status !== 'OPEN' || slip.autoFreezeAt.getTime() <= now.getTime()
}

export function toAdminSlipView(slip: AdminBetSlip, now = new Date()): AdminBetSlipView {
  return {
    id: slip.id,
    code: slip.code,
    title: slip.title,
    mode: slip.mode === 'SANDBOX' ? 'SANDBOX' : 'LIVE',
    status: slip.status as AdminBetSlipStatusView,
    frozen: isSlipFrozen(slip, now),
    frozenReason:
      slip.freezeReason ??
      (slip.autoFreezeAt.getTime() <= now.getTime()
        ? 'Betting closed because the first match has started.'
        : null),
    autoFreezeAt: slip.autoFreezeAt.toISOString(),
    createdAt: slip.createdAt.toISOString(),
    stakeMinor: slip.stakeMinor,
    totalOdds: slip.totalOdds,
    potentialReturnMinor: slip.potentialReturnMinor,
    selections: parseSelections(slip.selections),
  }
}

function toEntryView(
  entry: {
    id: string
    phone: string
    stakeMinor: number
    status: string
    providerOrderId: string | null
    ticketId: string | null
    failureReason: string | null
    paidAt: Date | null
    createdAt: Date
  },
  ticketCode: string | null = null,
): AdminBetEntryView {
  return {
    id: entry.id,
    phoneMasked: maskPhone(entry.phone),
    stakeMinor: entry.stakeMinor,
    status: entry.status as AdminBetEntryView['status'],
    providerOrderId: entry.providerOrderId,
    ticketId: entry.ticketId,
    ticketCode,
    failureReason: entry.failureReason,
    paidAt: entry.paidAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  }
}

async function ticketCodesById(ticketIds: Array<string | null>): Promise<Map<string, string>> {
  const ids = ticketIds.filter((id): id is string => Boolean(id))
  if (ids.length === 0) return new Map()
  const tickets = await prisma.betTicket.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true },
  })
  return new Map(tickets.map(ticket => [ticket.id, ticket.code]))
}

export async function createAdminBetSlip(input: {
  createdBy: string
  title?: string | null
  stakeMinor: number
  selections: AdminSlipSelectionInput[]
  now?: Date
}): Promise<AdminBetSlipView> {
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
    throw new BetError('Add at least one selection.', 422, 'EMPTY_SLIP')
  }
  if (input.selections.length > MAX_SELECTIONS) {
    throw new BetError(
      `A slip can hold at most ${MAX_SELECTIONS} selections.`,
      422,
      'TOO_MANY_SELECTIONS',
    )
  }

  const catalog = await getBetCatalog(now)
  const eventById = new Map(catalog.events.map(event => [event.id, event]))
  const seenFixtures = new Set<string>()

  const selections: TicketSelection[] = input.selections.map(selection => {
    const event = eventById.get(selection.fixtureId)
    if (!event) {
      throw new BetError('One of the selected fixtures is no longer available.', 422, 'UNKNOWN_FIXTURE')
    }
    if (event.effectiveStatus !== 'SCHEDULED' && !event.live) {
      throw new BetError('Only upcoming fixtures can be added to a slip.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }
    if (event.kickoffIso && new Date(event.kickoffIso).getTime() <= now.getTime()) {
      throw new BetError('This match has already started.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }
    if (seenFixtures.has(event.id)) {
      throw new BetError('Choose only one selection per fixture.', 422, 'DUPLICATE_FIXTURE')
    }
    seenFixtures.add(event.id)

    const market = event.markets.find(item => item.id === selection.marketId)
    const option = market?.selections.find(item => item.selectionId === selection.selectionId)
    if (!market || !option) {
      throw new BetError('That market selection is not available.', 422, 'UNKNOWN_SELECTION')
    }
    if (!Number.isFinite(selection.odds) || selection.odds < 1.01 || selection.odds > 1000) {
      throw new BetError('Odds must be between 1.01 and 1000.', 422, 'BAD_ODDS')
    }

    return {
      fixtureId: event.id,
      fixtureLabel: `${event.home.name} vs ${event.away.name}`,
      competition: event.competition,
      kickoffIso: event.kickoffIso,
      marketId: market.id,
      marketName: market.name,
      selectionId: option.selectionId,
      selectionLabel: option.label,
      odds: Math.round(selection.odds * 100) / 100,
      probability: option.probability,
      result: 'PENDING',
      finalScore: null,
      demoResult: false,
      kickoffLabel: formatKickoffLabel(event.kickoffIso),
    } as TicketSelection
  })

  selections.sort((left, right) => new Date(left.kickoffIso).getTime() - new Date(right.kickoffIso).getTime())
  const { totalOdds, potentialReturnMinor } = computeTicketTotals(input.stakeMinor, selections)
  const autoFreezeAt = new Date(selections[0].kickoffIso)
  const mode = await getBetMode()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(6)
    try {
      const slip = await prisma.adminBetSlip.create({
        data: {
          code,
          title: input.title?.trim().slice(0, 120) || null,
          mode,
          selections: selections as unknown as Prisma.InputJsonValue,
          totalOdds,
          stakeMinor: input.stakeMinor,
          potentialReturnMinor,
          autoFreezeAt,
          createdBy: input.createdBy,
        },
      })
      return toAdminSlipView(slip, now)
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
    }
  }

  throw new BetError('Could not generate a slip code. Please try again.', 503, 'CODE_UNAVAILABLE')
}

export async function getAdminBetSlipByCode(
  code: string,
  now = new Date(),
): Promise<AdminBetSlipView> {
  const slip = await prisma.adminBetSlip.findUnique({
    where: { code: code.trim().toUpperCase() },
  })
  if (!slip) {
    throw new BetError('That slip code does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  return toAdminSlipView(slip, now)
}

export async function getAdminBetSlip(
  id: string,
  now = new Date(),
): Promise<AdminBetSlipView> {
  const slip = await prisma.adminBetSlip.findUnique({ where: { id } })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  return toAdminSlipView(slip, now)
}

export async function listAdminBetSlips(now = new Date()): Promise<AdminBetSlipListItem[]> {
  const slips = await prisma.adminBetSlip.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: {
      entries: {
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  })

  const ticketIds = slips.flatMap(slip => slip.entries.map(entry => entry.ticketId))
  const codeByTicket = await ticketCodesById(ticketIds)

  return slips.map(slip => {
    const entries = slip.entries.map(entry =>
      toEntryView(entry, entry.ticketId ? codeByTicket.get(entry.ticketId) ?? null : null),
    )
    return {
      ...toAdminSlipView(slip, now),
      entries,
      entryCount: entries.filter(entry => ACTIVE_ENTRY_STATUSES.has(entry.status)).length,
      paidCount: entries.filter(entry => entry.status === 'PAID').length,
    }
  })
}

export async function freezeAdminBetSlip(input: {
  id: string
  reason?: string | null
  actorId: string
  now?: Date
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const slip = await prisma.adminBetSlip.update({
    where: { id: input.id },
    data: {
      status: 'FROZEN',
      freezeReason: input.reason?.trim().slice(0, 200) || 'Betting was paused by an administrator.',
      frozenAt: now,
      frozenBy: input.actorId,
    },
  })
  return toAdminSlipView(slip, now)
}

export async function unfreezeAdminBetSlip(input: {
  id: string
  actorId: string
  now?: Date
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const existing = await prisma.adminBetSlip.findUnique({ where: { id: input.id } })
  if (!existing) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  if (existing.autoFreezeAt.getTime() <= now.getTime()) {
    throw new BetError(
      'This slip cannot be reopened because the first match has already started.',
      409,
      'SLIP_EXPIRED',
    )
  }

  const slip = await prisma.adminBetSlip.update({
    where: { id: input.id },
    data: {
      status: 'OPEN',
      freezeReason: null,
      frozenAt: null,
      frozenBy: input.actorId,
    },
  })
  return toAdminSlipView(slip, now)
}

export async function listAdminBetEntries(slipId: string): Promise<AdminBetEntryView[]> {
  const entries = await prisma.adminBetEntry.findMany({
    where: { slipId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const codeByTicket = await ticketCodesById(entries.map(entry => entry.ticketId))
  return entries.map(entry =>
    toEntryView(entry, entry.ticketId ? codeByTicket.get(entry.ticketId) ?? null : null),
  )
}
export async function placeAdminSlipBet(input: {
  entryId: string
  now?: Date
}): Promise<BetTicketView | null> {
  const now = input.now ?? new Date()
  const entry = await prisma.adminBetEntry.findUnique({ where: { id: input.entryId } })
  if (!entry) {
    throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  }
  if (entry.status !== 'PAID') {
    throw new BetError('The payment is not confirmed yet.', 409, 'ENTRY_NOT_PAID')
  }

  const existing = await resolvePlacedTicket(entry.ticketId)
  if (existing) return existing
  if (entry.ticketId) return null

  const userId = entry.userId
  if (!userId) return null

  const slip = await prisma.adminBetSlip.findUnique({ where: { id: entry.slipId } })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }

  const selections = parseSelections(slip.selections)
  if (selections.length === 0) {
    throw new BetError('This slip has no selections to place.', 422, 'EMPTY_SLIP')
  }

  const { totalOdds, potentialReturnMinor } = computeTicketTotals(slip.stakeMinor, selections)
  const code = await generateTicketCode()
  const draft: TicketDraft = {
    code,
    stakeMinor: slip.stakeMinor,
    selections,
    totalOdds,
    potentialReturnMinor,
    debitBalance: entry.provider === 'sandbox',
    reference: `slip:${slip.code}:entry:${entry.id}:stake`,
    note: `Slip ${slip.code}`,
  }

  try {
    const ticket = await prisma.$transaction(async tx => {
      const claim = await tx.adminBetEntry.updateMany({
        where: { id: entry.id, status: 'PAID', ticketId: null, placementStartedAt: null },
        data: { placementStartedAt: now },
      })
      if (claim.count === 0) return null

      const created = await insertTicket(tx, userId, draft)
      await tx.adminBetEntry.update({
        where: { id: entry.id },
        data: { ticketId: created.id },
      })
      return created
    })

    if (!ticket) {
      const current = await prisma.adminBetEntry.findUnique({ where: { id: entry.id } })
      return resolvePlacedTicket(current?.ticketId)
    }

    return toTicketView(ticket)
  } catch (error) {
    const failureReason = error instanceof BetError ? error.code : 'BET_FAILED'
    await prisma.adminBetEntry.update({
      where: { id: entry.id },
      data: { status: 'FAILED', failureReason },
    })
    throw error
  }
}

async function resolvePlacedTicket(ticketId: string | null | undefined): Promise<BetTicketView | null> {
  if (!ticketId) return null
  const ticket = await prisma.betTicket.findUnique({ where: { id: ticketId } })
  return ticket ? toTicketView(ticket) : null
}