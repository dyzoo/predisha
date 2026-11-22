import { Prisma, type AdminBetSlip } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  computeTicketTotals,
  forceWinTicket,
  generateTicketCode,
  insertTicket,
  settleAllOpenTickets,
  toTicketView,
  type TicketDraft,
} from './bets'
import { getBetCatalog } from './catalog'
import { BetError, isUniqueConstraintError } from './errors'
import { formatKickoffLabel } from './format'
import { randomCode } from './random'
import { getBetMode, type BetMode } from './mode'
import { getMinStakeMinor } from './stake-settings'
import { clockFromKickoff, inPlayQuote } from './in-play'
import { matchClock, type MatchClockState } from './match-clock'
import {
  attachSimulationClock,
  DEFAULT_SIMULATED_DURATION_MINUTES,
  simulationClockForSelection,
} from './simulation'
import {
  MAX_SELECTIONS,
  MAX_STAKE_MINOR,
  type AdminSlipSelectionSource,
  type AdminSlipTimeMode,
  isProviderFixtureId,
  type BetTicketView,
  type TicketSelection,
  type TicketSimulationMeta,
} from './types'


export type AdminBetSlipStatusView = 'OPEN' | 'FROZEN' | 'CLOSED'

export interface AdminSlipSelectionInput {
  fixtureId: string
  marketId: string
  selectionId: string
  odds: number
  custom?: boolean
  fixtureLabel?: string
  competition?: string
  kickoffIso?: string
  marketName?: string
  selectionLabel?: string
  probability?: number
  finalScore?: { home: number; away: number } | null
}

export interface AdminSlipMatchView {
  phase: MatchClockState['phase']
  label: string
  minute: number
  progress: number
  live: boolean
  finished: boolean
}

export interface AdminSlipQuoteView {
  factor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
}

export interface AdminBetSlipView {
  id: string
  code: string
  title: string | null
  mode: BetMode
  status: AdminBetSlipStatusView
  timeMode: AdminSlipTimeMode
  selectionSource: AdminSlipSelectionSource
  manualKickoffAt: string | null
  simulatedDurationMinutes: number
  liveStartedAt: string | null
  frozen: boolean
  frozenReason: string | null
  inPlay: boolean
  matchClock: AdminSlipMatchView | null
  clock: TicketSimulationMeta | null
  quote: AdminSlipQuoteView
  autoFreezeAt: string
  createdAt: string
  stakeMinor: number
  totalOdds: number
  potentialReturnMinor: number
  vatMinor: number
  netPayoutMinor: number
  selections: TicketSelection[]
}

export interface AdminBetEntryView {
  id: string
  phoneMasked: string
  userId: string | null
  userName: string | null
  stakeMinor: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
  providerOrderId: string | null
  ticketId: string | null
  ticketCode: string | null
  ticketStatus: string | null
  ticketPayoutMinor: number | null
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

function usesSimulationClock(
  slip: { timeMode: string; selectionSource: string },
  selections: TicketSelection[] = [],
): boolean {
  return (
    slip.timeMode === 'SIMULATED' ||
    slip.selectionSource === 'RANDOM' ||
    selections.some(selection => !isProviderFixtureId(selection.fixtureId))
  )
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  return `${digits.slice(0, 5)}•••${digits.slice(-2)}`
}

export async function assertBetStakeMinor(stakeMinor: number): Promise<void> {
  if (!Number.isInteger(stakeMinor)) {
    throw new BetError('Stake must be a whole amount.', 422, 'BAD_STAKE')
  }
  const minimum = await getMinStakeMinor()
  if (stakeMinor < minimum || stakeMinor > MAX_STAKE_MINOR) {
    throw new BetError(
      `Stake must be between ${minimum} and ${MAX_STAKE_MINOR} TZS.`,
      422,
      'BAD_STAKE',
    )
  }
}

type SlipClockSource = Pick<AdminBetSlip, 'status' | 'autoFreezeAt'> &
  Partial<
    Pick<
      AdminBetSlip,
      | 'code'
      | 'timeMode'
      | 'manualKickoffAt'
      | 'liveStartedAt'
      | 'simulatedDurationMinutes'
      | 'selections'
      | 'freezeReason'
    >
  >

function toIso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return null
}

export function resolveMatchClock(
  slip: SlipClockSource,
  now: Date = new Date(),
): TicketSimulationMeta | null {
  if (slip.status === 'CLOSED') return null

  const durationMinutes = slip.simulatedDurationMinutes || DEFAULT_SIMULATED_DURATION_MINUTES
  const seed = slip.code ?? 'slip'
  const startedIso = toIso(slip.liveStartedAt)
  if (startedIso) {
    return {
      liveStartedAt: startedIso,
      durationMinutes,
      seed,
      kickoffIso: toIso(slip.manualKickoffAt) ?? startedIso,
    }
  }

  let kickoffIso: string | null = null
  if (slip.timeMode === 'MANUAL') {
    kickoffIso = toIso(slip.manualKickoffAt)
  } else if (slip.timeMode === 'ORIGINAL' && slip.selections) {
    const kickoffs = parseSelections(slip.selections)
      .map(selection => toIso(selection.kickoffIso))
      .filter((value): value is string => Boolean(value))
      .sort()
    kickoffIso = kickoffs[0] ?? null
  }

  if (!kickoffIso || new Date(kickoffIso).getTime() > now.getTime()) return null
  return clockFromKickoff(kickoffIso, durationMinutes, seed, now.getTime())
}

function isInPlayFreezeMarker(reason: string | null | undefined): boolean {
  const value = reason?.trim().toLowerCase() ?? ''
  return value.includes('in-play') || value.includes('simulated matches are live')
}

export function isSlipFrozen(slip: SlipClockSource, now = new Date()): boolean {
  if (slip.status === 'CLOSED') return true
  const clock = resolveMatchClock(slip, now)
  if (clock) {
    const state = matchClock(clock, now.getTime())
    if (state.finished) return true
    if (state.started) {
      if (slip.status === 'FROZEN') return !isInPlayFreezeMarker(slip.freezeReason)
      return false
    }
  }
  if (slip.status === 'FROZEN') return true
  return slip.autoFreezeAt.getTime() <= now.getTime()
}

export function slipFreezeReason(slip: SlipClockSource, now = new Date()): string | null {
  if (slip.status === 'CLOSED') return slip.freezeReason?.trim() || 'Betting is closed for this slip.'
  const clock = resolveMatchClock(slip, now)
  if (clock) {
    const state = matchClock(clock, now.getTime())
    if (state.finished) return slip.freezeReason?.trim() || 'Full time. Betting is closed for this slip.'
    if (state.started) {
      if (slip.status === 'FROZEN' && !isInPlayFreezeMarker(slip.freezeReason)) {
        return slip.freezeReason?.trim() || 'Betting was paused by an administrator.'
      }
      return null
    }
  }
  if (slip.status === 'FROZEN') return slip.freezeReason?.trim() || 'Betting was paused by an administrator.'
  if (slip.autoFreezeAt.getTime() <= now.getTime()) {
    return slip.freezeReason?.trim() || 'Betting closed because the first match has started.'
  }
  return null
}

export function toAdminSlipView(slip: AdminBetSlip, now = new Date()): AdminBetSlipView {
  const selections = parseSelections(slip.selections)
  const clock = resolveMatchClock(slip, now)
  const match = clock ? matchClock(clock, now.getTime()) : null
  const frozen = isSlipFrozen(slip, now)
  const frozenReason = slipFreezeReason(slip, now)
  const simulate = usesSimulationClock(slip, selections)
  const displaySelections =
    clock && simulate ? attachSimulationClock(selections, clock) : selections
  const clockSources: TicketSimulationMeta[] =
    simulate && clock
      ? displaySelections.map(selection =>
          selection.simulation ?? simulationClockForSelection(selection, clock),
        )
      : []
  const inPlay = clockSources.some(candidate => matchClock(candidate, now.getTime()).live)
  const quote = inPlayQuote(slip.stakeMinor, displaySelections, clock, now.getTime())
  return {
    id: slip.id,
    code: slip.code,
    title: slip.title,
    mode: slip.mode === 'SANDBOX' ? 'SANDBOX' : 'LIVE',
    status: slip.status as AdminBetSlipStatusView,
    timeMode:
      slip.timeMode === 'MANUAL' || slip.timeMode === 'SIMULATED'
        ? slip.timeMode
        : 'ORIGINAL',
    selectionSource: slip.selectionSource === 'RANDOM' ? 'RANDOM' : 'CATALOG',
    manualKickoffAt: slip.manualKickoffAt?.toISOString() ?? null,
    simulatedDurationMinutes: slip.simulatedDurationMinutes || DEFAULT_SIMULATED_DURATION_MINUTES,
    liveStartedAt: slip.liveStartedAt?.toISOString() ?? null,
    frozen,
    frozenReason,
    inPlay,
    clock,
    matchClock: match
      ? {
          phase: match.phase,
          label: match.label,
          minute: match.minute,
          progress: match.progress,
          live: match.live,
          finished: match.finished,
        }
      : null,
    quote: {
      factor: quote.factor,
      totalOdds: quote.totalOdds,
      potentialReturnMinor: quote.potentialReturnMinor,
      vatMinor: quote.vatMinor,
      netPayoutMinor: quote.netPayoutMinor,
    },
    autoFreezeAt: slip.autoFreezeAt.toISOString(),
    createdAt: slip.createdAt.toISOString(),
    stakeMinor: slip.stakeMinor,
    totalOdds: quote.totalOdds,
    potentialReturnMinor: quote.potentialReturnMinor,
    vatMinor: quote.vatMinor,
    netPayoutMinor: quote.netPayoutMinor,
    selections: quote.selections,
  }
}

function toEntryView(
  entry: {
    id: string
    phone: string
    userId: string | null
    user: { name: string | null; email: string } | null
    stakeMinor: number
    status: string
    providerOrderId: string | null
    ticketId: string | null
    failureReason: string | null
    paidAt: Date | null
    createdAt: Date
  },
  ticketCode: string | null = null,
  ticketStatus: string | null = null,
  ticketPayoutMinor: number | null = null,
): AdminBetEntryView {
  return {
    id: entry.id,
    phoneMasked: maskPhone(entry.phone),
    userId: entry.userId,
    userName: entry.user?.name ?? entry.user?.email ?? null,
    stakeMinor: entry.stakeMinor,
    status: entry.status as AdminBetEntryView['status'],
    providerOrderId: entry.providerOrderId,
    ticketId: entry.ticketId,
    ticketCode,
    ticketStatus,
    ticketPayoutMinor,
    failureReason: entry.failureReason,
    paidAt: entry.paidAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  }
}

interface AdminTicketMeta {
  code: string
  status: string
  payoutMinor: number
}

async function ticketMetaById(
  ticketIds: Array<string | null>,
): Promise<Map<string, AdminTicketMeta>> {
  const ids = ticketIds.filter((id): id is string => Boolean(id))
  if (ids.length === 0) return new Map()
  const tickets = await prisma.betTicket.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, status: true, payoutMinor: true },
  })
  return new Map(
    tickets.map(ticket => [
      ticket.id,
      { code: ticket.code, status: ticket.status, payoutMinor: ticket.payoutMinor },
    ]),
  )
}

export async function createAdminBetSlip(input: {
  createdBy: string
  title?: string | null
  stakeMinor: number
  selections: AdminSlipSelectionInput[]
  timeMode?: AdminSlipTimeMode
  selectionSource?: AdminSlipSelectionSource
  manualKickoffAt?: string | null
  simulatedDurationMinutes?: number
  now?: Date
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const timeMode = input.timeMode ?? 'ORIGINAL'
  const selectionSource = input.selectionSource ?? 'CATALOG'
  const simulatedDurationMinutes =
    input.simulatedDurationMinutes ?? DEFAULT_SIMULATED_DURATION_MINUTES

  await assertBetStakeMinor(input.stakeMinor)
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

  let manualKickoffAt: Date | null = null
  if (timeMode !== 'ORIGINAL') {
    if (!input.manualKickoffAt) {
      throw new BetError('Enter a manual kickoff time.', 422, 'MISSING_KICKOFF')
    }
    const parsed = new Date(input.manualKickoffAt)
    if (Number.isNaN(parsed.getTime())) {
      throw new BetError('Enter a valid manual kickoff time.', 422, 'BAD_KICKOFF')
    }
    manualKickoffAt = parsed
  }

  const hasCatalogSelections = input.selections.some(selection => !selection.custom)
  const catalog = hasCatalogSelections ? await getBetCatalog(now) : null
  const eventById = new Map((catalog?.events ?? []).map(event => [event.id, event]))
  const seenFixtures = new Set<string>()

  const selections: TicketSelection[] = input.selections.map(selection => {
    if (seenFixtures.has(selection.fixtureId)) {
      throw new BetError('Choose only one selection per fixture.', 422, 'DUPLICATE_FIXTURE')
    }
    seenFixtures.add(selection.fixtureId)

    if (!Number.isFinite(selection.odds) || selection.odds < 1.01 || selection.odds > 1000) {
      throw new BetError('Odds must be between 1.01 and 1000.', 422, 'BAD_ODDS')
    }

    if (selection.custom) {
      if (!selection.fixtureLabel || !selection.marketName || !selection.selectionLabel || !selection.kickoffIso) {
        throw new BetError('A random match is missing its teams, market or kickoff time.', 422, 'BAD_CUSTOM_SELECTION')
      }
      const customKickoff =
        timeMode === 'SIMULATED' && selection.kickoffIso
          ? selection.kickoffIso
          : manualKickoffAt?.toISOString() ?? selection.kickoffIso
      if (Number.isNaN(new Date(customKickoff).getTime())) {
        throw new BetError('This match has an invalid kickoff time.', 422, 'BAD_KICKOFF')
      }
      return {
        fixtureId: selection.fixtureId,
        fixtureLabel: selection.fixtureLabel,
        competition: selection.competition || 'Random selection',
        kickoffIso: customKickoff,
        marketId: selection.marketId,
        marketName: selection.marketName,
        selectionId: selection.selectionId,
        selectionLabel: selection.selectionLabel,
        odds: Math.round(selection.odds * 100) / 100,
        probability: selection.probability ?? 0.5,
        result: 'PENDING',
        finalScore: selection.finalScore ?? null,
        demoResult: false,
        kickoffLabel: formatKickoffLabel(customKickoff),
      } as TicketSelection
    }

    const event = eventById.get(selection.fixtureId)
    if (!event) {
      throw new BetError('One of the selected fixtures is no longer available.', 422, 'UNKNOWN_FIXTURE')
    }
    if (event.effectiveStatus !== 'SCHEDULED' && !event.live) {
      throw new BetError('Only upcoming fixtures can be added to a slip.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }
    if (timeMode === 'ORIGINAL' && event.kickoffIso && new Date(event.kickoffIso).getTime() <= now.getTime()) {
      throw new BetError('This match has already started.', 422, 'FIXTURE_CLOSED', {
        fixtureId: event.id,
      })
    }

    const market = event.markets.find(item => item.id === selection.marketId)
    const option = market?.selections.find(item => item.selectionId === selection.selectionId)
    if (!market || !option) {
      throw new BetError('That market selection is not available.', 422, 'UNKNOWN_SELECTION')
    }

    const effectiveKickoff =
      timeMode === 'SIMULATED' && selection.kickoffIso
        ? selection.kickoffIso
        : manualKickoffAt?.toISOString() ?? event.kickoffIso
    return {
      fixtureId: event.id,
      fixtureLabel: `${event.home.name} vs ${event.away.name}`,
      competition: event.competition,
      kickoffIso: effectiveKickoff,
      marketId: market.id,
      marketName: market.name,
      selectionId: option.selectionId,
      selectionLabel: option.label,
      odds: Math.round(selection.odds * 100) / 100,
      probability: option.probability,
      result: 'PENDING',
      finalScore: selection.finalScore ?? null,
      demoResult: false,
      kickoffLabel: formatKickoffLabel(effectiveKickoff),
    } as TicketSelection
  })

  selections.sort((left, right) => new Date(left.kickoffIso).getTime() - new Date(right.kickoffIso).getTime())
  const { totalOdds, potentialReturnMinor } = computeTicketTotals(input.stakeMinor, selections)
  const lastKickoffMs = Math.max(
    ...selections.map(selection => new Date(selection.kickoffIso).getTime()),
  )
  const autoFreezeAt =
    timeMode === 'SIMULATED'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : manualKickoffAt ?? new Date(Number.isFinite(lastKickoffMs) ? lastKickoffMs : now.getTime())
  const mode = await getBetMode()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(6)
    try {
      const slip = await prisma.adminBetSlip.create({
        data: {
          code,
          title: input.title?.trim().slice(0, 120) || null,
          mode,
          timeMode,
          selectionSource,
          manualKickoffAt,
          simulatedDurationMinutes,
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
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  const ticketIds = slips.flatMap(slip => slip.entries.map(entry => entry.ticketId))
  const metaByTicket = await ticketMetaById(ticketIds)

  return slips.map(slip => {
    const entries = slip.entries.map(entry => {
      const meta = entry.ticketId ? metaByTicket.get(entry.ticketId) : undefined
      return toEntryView(entry, meta?.code ?? null, meta?.status ?? null, meta?.payoutMinor ?? null)
    })
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
  if (existing.status !== 'FROZEN') {
    throw new BetError('Only a frozen slip can be reopened.', 409, 'SLIP_NOT_FROZEN')
  }
  const clock = resolveMatchClock(existing, now)
  if (clock && matchClock(clock, now.getTime()).finished) {
    throw new BetError('A finished slip cannot be reopened.', 409, 'SLIP_FINISHED')
  }

  const nextAutoFreezeAt =
    existing.autoFreezeAt.getTime() <= now.getTime()
      ? new Date(now.getTime() + 15 * 60_000)
      : existing.autoFreezeAt
  const slip = await prisma.adminBetSlip.update({
    where: { id: input.id },
    data: {
      status: 'OPEN',
      freezeReason: null,
      frozenAt: null,
      frozenBy: input.actorId,
      autoFreezeAt: nextAutoFreezeAt,
    },
  })
  return toAdminSlipView(slip, now)
}

export async function closeAdminBetSlip(input: {
  id: string
  reason?: string | null
  actorId: string
  now?: Date
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const existing = await prisma.adminBetSlip.findUnique({ where: { id: input.id } })
  if (!existing) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  if (existing.status === 'CLOSED') {
    return toAdminSlipView(existing, now)
  }

  const slip = await prisma.$transaction(async tx => {
    const updated = await tx.adminBetSlip.update({
      where: { id: input.id },
      data: {
        status: 'CLOSED',
        freezeReason:
          input.reason?.trim().slice(0, 200) || 'Betting was closed by an administrator.',
        frozenAt: now,
        frozenBy: input.actorId,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.slip.close',
        target: existing.code,
        metadata: { title: existing.title, previousStatus: existing.status },
      },
    })
    return updated
  })
  return toAdminSlipView(slip, now)
}

export async function startAdminSlipSimulation(input: {
  id: string
  actorId: string
  now?: Date
}): Promise<AdminBetSlipView> {
  return startAdminBetSlip(input)
}

export async function startAdminBetSlip(input: {
  id: string
  actorId: string
  now?: Date
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const slip = await prisma.adminBetSlip.findUnique({
    where: { id: input.id },
    include: {
      entries: {
        where: { ticketId: { not: null } },
        select: { ticketId: true },
      },
    },
  })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  if (slip.status === 'CLOSED') {
    throw new BetError('A closed slip cannot go live.', 409, 'SLIP_CLOSED')
  }
  const existingClock = resolveMatchClock(slip, now)
  if (existingClock && matchClock(existingClock, now.getTime()).started) {
    return toAdminSlipView(slip, now)
  }

  const durationMinutes = slip.simulatedDurationMinutes || DEFAULT_SIMULATED_DURATION_MINUTES
  const existingSelections = parseSelections(slip.selections)
  const clock = {
    liveStartedAt: now.toISOString(),
    durationMinutes,
    seed: slip.code,
    kickoffIso:
      slip.manualKickoffAt?.toISOString() ??
      existingSelections
        .map(s => s.kickoffIso)
        .filter(Boolean)
        .sort()[0] ??
      now.toISOString(),
  }
  const simulate = usesSimulationClock(slip, existingSelections)
  const slipSelections = simulate
    ? attachSimulationClock(existingSelections, clock)
    : existingSelections
  const ticketIds = [...new Set(slip.entries.map(entry => entry.ticketId).filter(Boolean))] as string[]

  const updated = await prisma.$transaction(async tx => {
    const claimed = await tx.adminBetSlip.updateMany({
      where: { id: slip.id, status: { in: ['OPEN', 'FROZEN'] } },
      data: {
        status: 'OPEN',
        freezeReason: 'Match has started. In-play stakes are available at reduced prices.',
        liveStartedAt: now,
        frozenAt: null,
        frozenBy: input.actorId,
        selections: slipSelections as unknown as Prisma.InputJsonValue,
      },
    })
    if (claimed.count === 0) {
      return (await tx.adminBetSlip.findUnique({ where: { id: slip.id } })) ?? slip
    }

    for (const ticketId of ticketIds) {
      const ticket = await tx.betTicket.findUnique({ where: { id: ticketId } })
      if (!ticket || ticket.status !== 'OPEN') continue
      const ticketSelections = simulate
        ? attachSimulationClock(parseSelections(ticket.selections), clock)
        : parseSelections(ticket.selections)
      await tx.betTicket.update({
        where: { id: ticket.id },
        data: { selections: ticketSelections as unknown as Prisma.InputJsonValue },
      })
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.slip.start-match',
        target: slip.code,
        metadata: { liveStartedAt: clock.liveStartedAt, durationMinutes: clock.durationMinutes },
      },
    })
    return tx.adminBetSlip.findUniqueOrThrow({ where: { id: slip.id } })
  })

  return toAdminSlipView(updated, now)
}

export async function setAdminSlipLiveScores(input: {
  id: string
  actorId: string
  now?: Date
  results?: Array<{ fixtureId: string; homeScore: number; awayScore: number; minute?: number }>
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  if (!input.results?.length) {
    throw new BetError('Enter at least one live score.', 400, 'LIVE_SCORE_REQUIRED')
  }

  const slip = await prisma.adminBetSlip.findUnique({
    where: { id: input.id },
    include: { entries: { where: { ticketId: { not: null } }, select: { ticketId: true } } },
  })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  if (slip.status === 'CLOSED') {
    throw new BetError('A closed slip cannot be updated.', 409, 'SLIP_CLOSED')
  }

  const resultByFixture = new Map(input.results.map(result => [result.fixtureId, result]))
  const applyLiveScore = (selection: TicketSelection) => {
    const result = resultByFixture.get(selection.fixtureId)
    if (!result) return selection
    return {
      ...selection,
      result: 'PENDING' as const,
      finalScore: null,
      liveScore: { home: result.homeScore, away: result.awayScore },
      liveMinute: result.minute ?? selection.liveMinute ?? null,
    }
  }

  const selections = parseSelections(slip.selections).map(applyLiveScore)
  const ticketIds = [...new Set(slip.entries.map(entry => entry.ticketId).filter(Boolean))] as string[]

  const updated = await prisma.$transaction(async tx => {
    const next = await tx.adminBetSlip.update({
      where: { id: slip.id },
      data: {
        status: 'OPEN',
        frozenAt: null,
        liveStartedAt: slip.liveStartedAt ?? now,
        freezeReason: 'Live score updated by admin. In-play stakes are available.',
        selections: selections as unknown as Prisma.InputJsonValue,
      },
    })

    for (const ticketId of ticketIds) {
      const ticket = await tx.betTicket.findUnique({ where: { id: ticketId } })
      if (!ticket || ticket.status !== 'OPEN') continue
      const ticketSelections = parseSelections(ticket.selections).map(applyLiveScore)
      await tx.betTicket.update({
        where: { id: ticket.id },
        data: { selections: ticketSelections as unknown as Prisma.InputJsonValue },
      })
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.slip.set-live-score',
        target: slip.code,
        metadata: {
          updatedAt: now.toISOString(),
          resultsProvided: input.results?.length ?? 0,
        },
      },
    })
    return next
  })

  return toAdminSlipView(updated, now)
}

export async function finishAdminBetSlip(input: {
  id: string
  actorId: string
  now?: Date
  results?: Array<{ fixtureId: string; homeScore: number; awayScore: number }>
}): Promise<AdminBetSlipView> {
  const now = input.now ?? new Date()
  const resultByFixture = new Map(
    (input.results ?? []).map(result => [result.fixtureId, result]),
  )
  const slip = await prisma.adminBetSlip.findUnique({
    where: { id: input.id },
    include: { entries: { where: { ticketId: { not: null } }, select: { ticketId: true } } },
  })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }
  if (slip.status === 'CLOSED') return toAdminSlipView(slip, now)

  const durationMinutes = slip.simulatedDurationMinutes || DEFAULT_SIMULATED_DURATION_MINUTES
  const finishedStartedAt = new Date(now.getTime() - (durationMinutes + 20) * 60_000)
  const selections = parseSelections(slip.selections)
  const baseClock = resolveMatchClock(slip, now) ?? {
    liveStartedAt: finishedStartedAt.toISOString(),
    durationMinutes,
    seed: slip.code,
    kickoffIso: slip.manualKickoffAt?.toISOString() ?? now.toISOString(),
  }
  const simulate = usesSimulationClock(slip, selections)
  const finishedSelections = selections.map(selection => {
    const sourceClock = selection.simulation ?? simulationClockForSelection(selection, baseClock)
    const result = resultByFixture.get(selection.fixtureId)
    return {
      ...selection,
      result: result ? ('WON' as const) : selection.result,
      finalScore: result
        ? { home: result.homeScore, away: result.awayScore }
        : (selection.finalScore ?? selection.liveScore ?? null),
      liveScore: null,
      liveMinute: null,
      ...(simulate
        ? {
            simulation: {
              ...sourceClock,
              liveStartedAt: new Date(
                now.getTime() - ((sourceClock.durationMinutes || durationMinutes) + 20) * 60_000,
              ).toISOString(),
            },
          }
        : {}),
    }
  })
  const ticketIds = [...new Set(slip.entries.map(entry => entry.ticketId).filter(Boolean))] as string[]

  const updated = await prisma.$transaction(async tx => {
    const next = await tx.adminBetSlip.update({
      where: { id: slip.id },
      data: {
        status: 'FROZEN',
        freezeReason: 'Full time. Betting is closed for this slip.',
        frozenAt: now,
        frozenBy: input.actorId,
        liveStartedAt: slip.liveStartedAt ?? finishedStartedAt,
        selections: finishedSelections as unknown as Prisma.InputJsonValue,
      },
    })
    for (const ticketId of ticketIds) {
      const ticket = await tx.betTicket.findUnique({ where: { id: ticketId } })
      if (!ticket || ticket.status !== 'OPEN') continue
      const ticketBase = simulate
        ? attachSimulationClock(parseSelections(ticket.selections), baseClock)
        : parseSelections(ticket.selections)
      const ticketSelections = ticketBase.map(selection => {
        const sourceClock = selection.simulation ?? simulationClockForSelection(selection, baseClock)
        const result = resultByFixture.get(selection.fixtureId)
        return {
          ...selection,
          result: result ? ('WON' as const) : selection.result,
          finalScore: result
            ? { home: result.homeScore, away: result.awayScore }
            : selection.finalScore,
          ...(simulate
            ? {
                simulation: {
                  ...sourceClock,
                  liveStartedAt: new Date(
                    now.getTime() - ((sourceClock.durationMinutes || durationMinutes) + 20) * 60_000,
                  ).toISOString(),
                },
              }
            : {}),
        }
      })
      await tx.betTicket.update({
        where: { id: ticket.id },
        data: { selections: ticketSelections as unknown as Prisma.InputJsonValue },
      })
    }
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.slip.finish-match',
        target: slip.code,
        metadata: {
          finishedAt: now.toISOString(),
          resultsProvided: input.results?.length ?? 0,
        },
      },
    })
    return next
  })
  await settleAllOpenTickets(now).catch(() => undefined)
  return toAdminSlipView(updated, now)
}

export function canDeleteAdminBetSlip(slip: {
  status: AdminBetSlipStatusView
  entries: Array<{ status: string; ticketId: string | null }>
}): boolean {
  if (slip.status === 'CLOSED') return true
  return !slip.entries.some(
    entry => entry.ticketId !== null || entry.status === 'PAID' || entry.status === 'PENDING',
  )
}

export async function deleteAdminBetSlip(input: {
  id: string
  actorId: string
  ipAddress?: string | null
}): Promise<{ code: string }> {
  const slip = await prisma.adminBetSlip.findUnique({
    where: { id: input.id },
    include: {
      entries: {
        select: { id: true, status: true, ticketId: true },
      },
    },
  })
  if (!slip) {
    throw new BetError('That bet slip does not exist.', 404, 'SLIP_NOT_FOUND')
  }

  if (!canDeleteAdminBetSlip(slip)) {
    throw new BetError(
      'Close this slip before deleting it.',
      409,
      'SLIP_HAS_ACTIVE_ENTRIES',
    )
  }

  await prisma.$transaction(async tx => {
    await tx.adminBetSlip.delete({ where: { id: slip.id } })
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'admin.slip.delete',
        target: slip.code,
        ipAddress: input.ipAddress ?? null,
        metadata: {
          title: slip.title,
          mode: slip.mode,
          stakeMinor: slip.stakeMinor,
          deletedEntries: slip.entries.length,
        },
      },
    })
  })

  return { code: slip.code }
}

export async function listAdminBetEntries(slipId: string): Promise<AdminBetEntryView[]> {
  const entries = await prisma.adminBetEntry.findMany({
    where: { slipId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  })
  const metaByTicket = await ticketMetaById(entries.map(entry => entry.ticketId))
  return entries.map(entry => {
    const meta = entry.ticketId ? metaByTicket.get(entry.ticketId) : undefined
    return toEntryView(entry, meta?.code ?? null, meta?.status ?? null, meta?.payoutMinor ?? null)
  })
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
  await assertBetStakeMinor(entry.stakeMinor)

  const slipSelections = parseSelections(slip.selections)
  if (slipSelections.length === 0) {
    throw new BetError('This slip has no selections to place.', 422, 'EMPTY_SLIP')
  }
  const simulate = usesSimulationClock(slip, slipSelections)
  const clock = simulate ? resolveMatchClock(slip, now) : null
  const clocked = clock ? attachSimulationClock(slipSelections, clock) : slipSelections
  const quote = inPlayQuote(entry.stakeMinor, clocked, clock, now.getTime())
  const selections = quote.selections
  const { totalOdds, potentialReturnMinor } = quote
  const code = await generateTicketCode()
  const draft: TicketDraft = {
    code,
    stakeMinor: entry.stakeMinor,
    selections,
    totalOdds,
    potentialReturnMinor,
    debitBalance: entry.provider === 'sandbox' || entry.provider === 'wallet',
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

export async function simulateAdminSlipEntryWin(input: {
  entryId: string
  actorId: string
  now?: Date
}): Promise<{ entry: AdminBetEntryView; payoutMinor: number }> {
  const now = input.now ?? new Date()
  const entry = await prisma.adminBetEntry.findUnique({
    where: { id: input.entryId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!entry) {
    throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  }
  if (entry.status !== 'PAID') {
    throw new BetError('The payment must be confirmed before it can be settled.', 409, 'ENTRY_NOT_PAID')
  }
  if (!entry.ticketId) {
    throw new BetError('Place the bet before settling this entry.', 409, 'ENTRY_NO_TICKET')
  }

  const ticket = await prisma.betTicket.findUnique({ where: { id: entry.ticketId } })
  if (!ticket) {
    throw new BetError('The ticket for this entry could not be found.', 404, 'TICKET_NOT_FOUND')
  }

  const settled = await forceWinTicket(ticket.id, now)
  await prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: 'admin.entry.simulate-win',
      target: ticket.code,
      metadata: {
        entryId: entry.id,
        slipId: entry.slipId,
        payoutMinor: settled.payoutMinor,
      },
    },
  })

  const meta = { code: settled.code, status: settled.status, payoutMinor: settled.payoutMinor }
  return {
    entry: toEntryView(entry, meta.code, meta.status, meta.payoutMinor),
    payoutMinor: settled.payoutMinor,
  }
}

async function resolvePlacedTicket(ticketId: string | null | undefined): Promise<BetTicketView | null> {
  if (!ticketId) return null
  const ticket = await prisma.betTicket.findUnique({ where: { id: ticketId } })
  return ticket ? toTicketView(ticket) : null
}






