import { Prisma, type BetTicket } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getBetCatalog, getFixtureResults, type FixtureResult } from './catalog'
import { BetError, isUniqueConstraintError } from './errors'
import { combineOdds, findSelection, settleMarket } from './odds'
import { hashString, mulberry32, randomCode } from './random'
import { creditWallet, debitWallet } from './wallet'
import {
  type BetSelectionInput,
  type BetTicketStatusView,
  type BetTicketView,
  type TicketResult,
  type TicketSelection,
} from './types'

function parseSelections(value: Prisma.JsonValue): TicketSelection[] {
  if (!Array.isArray(value)) return []
  return value as unknown as TicketSelection[]
}

export function toTicketView(
  ticket: BetTicket,
  cashoutOfferMinor: number | null = null,
): BetTicketView {
  const selections = parseSelections(ticket.selections)
  return {
    id: ticket.id,
    code: ticket.code,
    stakeMinor: ticket.stakeMinor,
    totalOdds: ticket.totalOdds,
    potentialReturnMinor: ticket.potentialReturnMinor,
    status: ticket.status as BetTicketStatusView,
    payoutMinor: ticket.payoutMinor,
    cashoutMinor: ticket.cashoutMinor,
    cashoutOfferMinor,
    selectionCount: ticket.selectionCount,
    selections,
    placedAt: ticket.placedAt.toISOString(),
    settledAt: ticket.settledAt?.toISOString() ?? null,
    demoEligible:
      selections.length > 0 && selections.every(selection => selection.fixtureId.startsWith('demo-')),
  }
}

export function buildSnapshot(
  input: BetSelectionInput[],
  events: Awaited<ReturnType<typeof getBetCatalog>>['events'],
  now: Date,
): TicketSelection[] {
  const eventById = new Map(events.map(event => [event.id, event]))
  const seen = new Set<string>()

  return input.map(selection => {
    const event = eventById.get(selection.fixtureId)
    if (!event) {
      throw new BetError('One of the fixtures is no longer available.', 422, 'UNKNOWN_FIXTURE')
    }
    if (
      event.effectiveStatus === 'FINISHED' ||
      event.effectiveStatus === 'POSTPONED' ||
      event.effectiveStatus === 'CANCELLED' ||
      event.effectiveStatus === 'ABANDONED'
    ) {
      throw new BetError('This fixture is closed for betting.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }
    if (
      event.status === 'SCHEDULED' &&
      new Date(event.kickoffIso).getTime() < now.getTime() - 10 * 60 * 1000
    ) {
      throw new BetError('This match has already started.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }

    const marketKey = `${event.id}:${selection.marketId}`
    if (seen.has(marketKey)) {
      throw new BetError('Choose only one selection per market.', 422, 'DUPLICATE_MARKET')
    }
    seen.add(marketKey)

    const option = findSelection(event, selection.marketId, selection.selectionId)
    if (!option) {
      throw new BetError('That market selection is not available.', 422, 'UNKNOWN_SELECTION')
    }
    if (Math.abs(option.odds - selection.odds) > 0.02) {
      throw new BetError('The odds changed. Review the updated price and try again.', 409, 'ODDS_CHANGED', {
        fixtureId: event.id,
        marketId: option.marketId,
        selectionId: option.selectionId,
        currentOdds: option.odds,
      })
    }

    return {
      fixtureId: event.id,
      fixtureLabel: `${event.home.name} vs ${event.away.name}`,
      competition: event.competition,
      kickoffIso: event.kickoffIso,
      marketId: option.marketId,
      marketName: option.marketName,
      selectionId: option.selectionId,
      selectionLabel: option.label,
      odds: option.odds,
      probability: option.probability,
      result: 'PENDING',
      finalScore: null,
      demoResult: false,
    } satisfies TicketSelection
  })
}

function sanitizeSelections(selections: TicketSelection[]): TicketSelection[] {
  return selections.map(selection => ({
    ...selection,
    result: 'PENDING' as TicketResult,
    finalScore: null,
    demoResult: false,
  }))
}

export async function generateTicketCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = randomCode(8)
    const existing = await prisma.betTicket.findUnique({ where: { code: candidate } })
    if (!existing) return candidate
  }
  throw new BetError('Could not create a ticket code. Please try again.', 503, 'CODE_UNAVAILABLE')
}

export function computeTicketTotals(
  stakeMinor: number,
  selections: TicketSelection[],
): { totalOdds: number; potentialReturnMinor: number } {
  const totalOdds = combineOdds(selections.map(selection => selection.odds))
  const potentialReturnMinor = Math.floor(stakeMinor * totalOdds)

  return { totalOdds, potentialReturnMinor }
}

export interface TicketDraft {
  code: string
  stakeMinor: number
  selections: TicketSelection[]
  totalOdds: number
  potentialReturnMinor: number
  debitBalance?: boolean
  reference?: string
  note?: string
}

export async function insertTicket(
  tx: Prisma.TransactionClient,
  userId: string,
  input: TicketDraft,
): Promise<BetTicket> {
  if (input.debitBalance !== false) {
    await debitWallet(tx, {
      userId,
      amountMinor: input.stakeMinor,
      type: 'BET_STAKE',
      reference: input.reference ?? `ticket:${input.code}:stake`,
      note: input.note ?? `Ticket ${input.code}`,
    })
  }

  return tx.betTicket.create({
    data: {
      userId,
      code: input.code,
      stakeMinor: input.stakeMinor,
      totalOdds: input.totalOdds,
      potentialReturnMinor: input.potentialReturnMinor,
      selectionCount: input.selections.length,
      selections: input.selections as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function placeBetFromSelections(
  userId: string,
  input: {
    stakeMinor: number
    selections: TicketSelection[]
    debitBalance?: boolean
    reference?: string
    note?: string
  },
): Promise<BetTicketView> {
  const selections = sanitizeSelections(input.selections)
  const { totalOdds, potentialReturnMinor } = computeTicketTotals(input.stakeMinor, selections)
  const code = await generateTicketCode()

  try {
    const ticket = await prisma.$transaction(tx =>
      insertTicket(tx, userId, {
        code,
        stakeMinor: input.stakeMinor,
        selections,
        totalOdds,
        potentialReturnMinor,
        debitBalance: input.debitBalance,
        reference: input.reference,
        note: input.note,
      }),
    )
    return toTicketView(ticket)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BetError('Could not place the bet. Please try again.', 409, 'DUPLICATE_TICKET')
    }
    throw error
  }
}

export async function placeBet(
  userId: string,
  input: { stakeMinor: number; selections: BetSelectionInput[] },
  now: Date = new Date(),
): Promise<BetTicketView> {
  const catalog = await getBetCatalog(now)
  const selections = buildSnapshot(input.selections, catalog.events, now)
  return placeBetFromSelections(userId, { stakeMinor: input.stakeMinor, selections })
}

export interface TicketEvaluation {
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID'
  payoutMinor: number
  selections: TicketSelection[]
  changed: boolean
}

export function evaluateTicket(
  selections: TicketSelection[],
  stakeMinor: number,
  results: Map<string, FixtureResult>,
): TicketEvaluation {
  let changed = false

  const next = selections.map(selection => {
    if (selection.result !== 'PENDING') return selection
    const result = results.get(selection.fixtureId)
    if (!result) return selection

    if (
      result.status === 'POSTPONED' ||
      result.status === 'CANCELLED' ||
      result.status === 'ABANDONED'
    ) {
      changed = true
      return { ...selection, result: 'VOID' as TicketResult, finalScore: null }
    }

    if (
      result.status === 'FINISHED' &&
      typeof result.homeScore === 'number' &&
      typeof result.awayScore === 'number'
    ) {
      const won = settleMarket(selection.selectionId, result.homeScore, result.awayScore)
      if (won === null) return selection
      changed = true
      return {
        ...selection,
        result: (won ? 'WON' : 'LOST') as TicketResult,
        finalScore: { home: result.homeScore, away: result.awayScore },
      }
    }

    return selection
  })

  if (next.some(selection => selection.result === 'LOST')) {
    return { status: 'LOST', payoutMinor: 0, selections: next, changed }
  }
  if (next.some(selection => selection.result === 'PENDING')) {
    return { status: 'OPEN', payoutMinor: 0, selections: next, changed }
  }
  if (next.every(selection => selection.result === 'VOID')) {
    return { status: 'VOID', payoutMinor: stakeMinor, selections: next, changed }
  }

  const adjustedOdds = combineOdds(
    next.filter(selection => selection.result === 'WON').map(selection => selection.odds),
  )
  return {
    status: 'WON',
    payoutMinor: Math.floor(stakeMinor * adjustedOdds),
    selections: next,
    changed,
  }
}

export async function forceWinTicket(
  ticketId: string,
  now: Date = new Date(),
): Promise<BetTicketView> {
  const ticket = await prisma.betTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new BetError('Ticket not found.', 404, 'TICKET_NOT_FOUND')
  if (ticket.status !== 'OPEN') {
    throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
  }

  const selections = parseSelections(ticket.selections).map(selection => ({
    ...selection,
    result: 'WON' as TicketResult,
  }))
  const payoutMinor = ticket.potentialReturnMinor

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.betTicket.updateMany({
      where: { id: ticket.id, status: 'OPEN' },
      data: {
        status: 'WON',
        payoutMinor,
        settledAt: now,
        selections: selections as unknown as Prisma.InputJsonValue,
      },
    })
    if (result.count === 0) {
      throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
    }
    await creditWallet(tx, {
      userId: ticket.userId,
      amountMinor: payoutMinor,
      type: 'BET_WIN',
      reference: `ticket:${ticket.code}:settle`,
      note: `Winnings ${ticket.code}`,
    })
    return tx.betTicket.findUniqueOrThrow({ where: { id: ticket.id } })
  })

  return toTicketView(updated)
}

async function persistSettlement(
  ticket: BetTicket,
  evaluation: TicketEvaluation,
  now: Date,
): Promise<BetTicket | null> {
  return prisma.$transaction(async tx => {
    const current = await tx.betTicket.findUnique({ where: { id: ticket.id } })
    if (!current || current.status !== 'OPEN') return null

    const updated = await tx.betTicket.update({
      where: { id: ticket.id },
      data: {
        status: evaluation.status,
        payoutMinor: evaluation.payoutMinor,
        settledAt: evaluation.status === 'OPEN' ? null : now,
        selections: evaluation.selections as unknown as Prisma.InputJsonValue,
      },
    })

    if (evaluation.payoutMinor > 0) {
      await creditWallet(tx, {
        userId: ticket.userId,
        amountMinor: evaluation.payoutMinor,
        type: evaluation.status === 'VOID' ? 'ADJUSTMENT' : 'BET_WIN',
        reference: `ticket:${ticket.code}:settle`,
        note: evaluation.status === 'VOID' ? `Void refund ${ticket.code}` : `Winnings ${ticket.code}`,
      })
    }

    return updated
  })
}

export async function settleTicketsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const results = await getFixtureResults(now)
  const tickets = await prisma.betTicket.findMany({
    where: { userId, status: 'OPEN' },
    orderBy: { placedAt: 'desc' },
    take: 100,
  })

  let settled = 0
  for (const ticket of tickets) {
    const evaluation = evaluateTicket(parseSelections(ticket.selections), ticket.stakeMinor, results)
    if (evaluation.status === 'OPEN' && !evaluation.changed) continue
    const updated = await persistSettlement(ticket, evaluation, now)
    if (updated && evaluation.status !== 'OPEN') settled += 1
  }
  return settled
}

export async function listTickets(
  userId: string,
  now: Date = new Date(),
): Promise<BetTicketView[]> {
  await settleTicketsForUser(userId, now)
  const tickets = await prisma.betTicket.findMany({
    where: { userId },
    orderBy: { placedAt: 'desc' },
    take: 50,
  })
  if (!tickets.some(ticket => ticket.status === 'OPEN')) {
    return tickets.map(ticket => toTicketView(ticket))
  }

  const catalog = await getBetCatalog(now)
  const results = await getFixtureResults(now)
  const eventById = new Map(catalog.events.map(event => [event.id, event]))

  return tickets.map(ticket => {
    if (ticket.status !== 'OPEN') return toTicketView(ticket)
    const quote = cashoutOffer(ticket, parseSelections(ticket.selections), results, eventById)
    return toTicketView(ticket, quote.blocked ? null : quote.offer)
  })
}

export async function getTicket(
  userId: string,
  ticketId: string,
): Promise<BetTicketView | null> {
  const ticket = await prisma.betTicket.findFirst({ where: { id: ticketId, userId } })
  return ticket ? toTicketView(ticket) : null
}

function cashoutOffer(
  ticket: Pick<BetTicket, 'stakeMinor' | 'potentialReturnMinor'>,
  selections: TicketSelection[],
  results: Map<string, FixtureResult>,
  eventById: Map<string, Awaited<ReturnType<typeof getBetCatalog>>['events'][number]>,
): { offer: number; blocked: boolean } {
  let allWinning = true
  let anyLosing = false

  for (const selection of selections) {
    const result = results.get(selection.fixtureId)
    if (
      result?.status === 'FINISHED' &&
      typeof result.homeScore === 'number' &&
      typeof result.awayScore === 'number'
    ) {
      const won = settleMarket(selection.selectionId, result.homeScore, result.awayScore)
      if (won === false) anyLosing = true
      if (won !== true) allWinning = false
      continue
    }

    const event = eventById.get(selection.fixtureId)
    if (event?.live && event.score) {
      const won = settleMarket(selection.selectionId, event.score.home, event.score.away)
      if (won === false) anyLosing = true
      if (won !== true) allWinning = false
      continue
    }

    allWinning = false
  }

  return {
    offer: allWinning
      ? Math.max(1, Math.floor(ticket.potentialReturnMinor * 0.65))
      : Math.max(1, Math.floor(ticket.stakeMinor * 0.5)),
    blocked: anyLosing,
  }
}

export async function cashoutTicket(
  userId: string,
  ticketId: string,
  now: Date = new Date(),
): Promise<BetTicketView> {
  const ticket = await prisma.betTicket.findFirst({ where: { id: ticketId, userId } })
  if (!ticket) throw new BetError('Ticket not found.', 404, 'TICKET_NOT_FOUND')
  if (ticket.status !== 'OPEN') {
    throw new BetError('This ticket is no longer open.', 409, 'TICKET_CLOSED')
  }

  const selections = parseSelections(ticket.selections)
  const catalog = await getBetCatalog(now)
  const results = await getFixtureResults(now)
  const eventById = new Map(catalog.events.map(event => [event.id, event]))
  const { offer, blocked } = cashoutOffer(ticket, selections, results, eventById)

  if (blocked) {
    throw new BetError('Cash out is unavailable while a selection is losing.', 409, 'CASHOUT_UNAVAILABLE')
  }

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.betTicket.updateMany({
      where: { id: ticket.id, userId, status: 'OPEN' },
      data: {
        status: 'CASHED_OUT',
        payoutMinor: offer,
        cashoutMinor: offer,
        settledAt: now,
      },
    })
    if (result.count === 0) {
      throw new BetError('This ticket is no longer open.', 409, 'TICKET_CLOSED')
    }
    await creditWallet(tx, {
      userId,
      amountMinor: offer,
      type: 'BET_CASHOUT',
      reference: `ticket:${ticket.code}:cashout`,
      note: `Cash out ${ticket.code}`,
    })
    return tx.betTicket.findUniqueOrThrow({ where: { id: ticket.id } })
  })

  return toTicketView(updated)
}

export async function resolveDemoTicket(
  userId: string,
  ticketId: string,
  now: Date = new Date(),
): Promise<BetTicketView> {
  const ticket = await prisma.betTicket.findFirst({ where: { id: ticketId, userId } })
  if (!ticket) throw new BetError('Ticket not found.', 404, 'TICKET_NOT_FOUND')
  if (ticket.status !== 'OPEN') {
    throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
  }

  const selections = parseSelections(ticket.selections)
  if (selections.length === 0 || !selections.every(selection => selection.fixtureId.startsWith('demo-'))) {
    throw new BetError('Only demo fixtures can be resolved with the demo resolver.', 422, 'NOT_DEMO')
  }

  const forced = selections.map(selection => {
    const random = mulberry32(hashString(`${ticket.id}:${selection.fixtureId}`))
    const home = Math.floor(random() * 4)
    const away = Math.floor(random() * 4)
    const won = settleMarket(selection.selectionId, home, away)
    return {
      ...selection,
      result: (won === true ? 'WON' : 'LOST') as TicketResult,
      finalScore: { home, away },
      demoResult: true,
    }
  })

  const evaluation = evaluateTicket(forced, ticket.stakeMinor, new Map())
  const updated = await persistSettlement(ticket, evaluation, now)
  if (!updated) {
    throw new BetError('This ticket is already settled.', 409, 'TICKET_CLOSED')
  }
  return toTicketView(updated)
}
