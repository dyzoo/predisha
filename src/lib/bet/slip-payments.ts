import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  SETTLO_PROVIDER_NAME,
  createSettloOrder,
  getSettloPayment,
  mapSettloState,
  settloApiKeyConfigured,
  type SettloWebhookEvent,
} from '@/lib/billing/settlopay'
import { BetError } from './errors'
import { normalizeTzPhone } from './phone'
import { creditWallet } from './wallet'
import {
  assertBetStakeMinor,
  getAdminBetSlipByCode,
  isSlipFrozen,
  maskPhone,
  toAdminSlipView,
  placeAdminSlipBet,
  type AdminBetSlipView,
} from './slips'

export interface SlipPaymentEntryView {
  id: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
  phoneMasked: string
  stakeMinor: number
  providerOrderId: string | null
  ticketId: string | null
  ticketCode: string | null
  paidAt: string | null
  createdAt: string
  message: string
}

export interface SlipPaymentResult {
  entry: SlipPaymentEntryView
  slip: AdminBetSlipView
  mode: 'LIVE' | 'SANDBOX'
}

async function resolveEntryUserId(
  userId: string | null | undefined,
  phone: string,
): Promise<string> {
  if (userId) return userId

  const guest = await prisma.user.upsert({
    where: { email: `guest-${phone}@guest.spotibet.invalid` },
    update: {},
    create: {
      email: `guest-${phone}@guest.spotibet.invalid`,
      preferences: { create: {} },
    },
    select: { id: true },
  })
  return guest.id
}

function entryView(
  entry: {
    id: string
    status: string
    phone: string
    stakeMinor: number
    provider: string | null
    providerOrderId: string | null
    ticketId: string | null
    paidAt: Date | null
    createdAt: Date
  },
  ticketCode: string | null = null,
): SlipPaymentEntryView {
  const status = entry.status as SlipPaymentEntryView['status']
  return {
    id: entry.id,
    status,
    phoneMasked: maskPhone(entry.phone),
    stakeMinor: entry.stakeMinor,
    providerOrderId: entry.providerOrderId,
    ticketId: entry.ticketId,
    ticketCode,
    paidAt: entry.paidAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    message:
      status === 'PAID' && entry.provider === 'wallet'
        ? 'Your bet is confirmed. The stake came from your wallet.'
        : status === 'PAID'
          ? 'Your bet is confirmed. Keep this page and your slip code for reference.'
          : status === 'FAILED' && entry.provider === 'wallet'
            ? 'The bet could not be placed. Your wallet was not charged.'
            : status === 'FAILED'
              ? 'The payment was not completed. You can try again.'
              : 'Approve the mobile-money prompt on your phone to complete this bet.',
  }
}

async function ticketCodeFor(ticketId: string | null): Promise<string | null> {
  if (!ticketId) return null
  const ticket = await prisma.betTicket.findUnique({
    where: { id: ticketId },
    select: { code: true },
  })
  return ticket?.code ?? null
}

async function loadEntryView(entryId: string): Promise<SlipPaymentEntryView> {
  const entry = await prisma.adminBetEntry.findUniqueOrThrow({ where: { id: entryId } })
  return entryView(entry, await ticketCodeFor(entry.ticketId))
}

async function markEntryPaid(entryId: string, paidAt = new Date()) {
  await prisma.adminBetEntry.updateMany({
    where: { id: entryId, status: { not: 'PAID' } },
    data: { status: 'PAID', paidAt, failureReason: null },
  })
  return prisma.adminBetEntry.findUniqueOrThrow({ where: { id: entryId } })
}

async function placeEntryBet(entryId: string): Promise<void> {
  try {
    await placeAdminSlipBet({ entryId })
  } catch (error) {
    console.error('[bet] could not place a bet for a paid slip entry', error)
  }
}

export async function startSlipPayment(input: {
  code: string
  phone: string
  userId?: string | null
  source?: 'wallet' | 'phone'
  stakeMinor?: number | null
  now?: Date
}): Promise<SlipPaymentResult> {
  const now = input.now ?? new Date()
  const slip = await getAdminBetSlipByCode(input.code, now)
  const record = await prisma.adminBetSlip.findUniqueOrThrow({ where: { code: slip.code } })
  const stakeMinor = input.stakeMinor ?? record.stakeMinor
  await assertBetStakeMinor(stakeMinor)

  if (isSlipFrozen(record, now)) {
    throw new BetError('Betting is closed for this slip.', 409, 'SLIP_FROZEN', {
      autoFreezeAt: record.autoFreezeAt.toISOString(),
    })
  }

  if (input.source === 'wallet') {
    if (!input.userId) {
      throw new BetError('Sign in to pay from your wallet.', 401, 'AUTH_REQUIRED')
    }
    const wallet = await prisma.betWallet.findUnique({
      where: { userId: input.userId },
      select: { balanceMinor: true },
    })
    const balanceMinor = wallet?.balanceMinor ?? 0
    if (balanceMinor < stakeMinor) {
      throw new BetError('Not enough balance in your wallet. Add funds to take this slip.', 422, 'INSUFFICIENT_FUNDS', {
        balanceMinor,
        stakeMinor,
      })
    }
    const entry = await prisma.adminBetEntry.create({
      data: {
        slipId: record.id,
        userId: input.userId,
        phone: input.phone.trim(),
        stakeMinor,
        selections: slip.selections as unknown as Prisma.InputJsonValue,
        totalOdds: slip.totalOdds,
        status: 'PAID',
        provider: 'wallet',
        paidAt: now,
      },
    })
    try {
      await placeAdminSlipBet({ entryId: entry.id, now })
    } catch (error) {
      await prisma.adminBetEntry.update({
        where: { id: entry.id },
        data: { status: 'FAILED', failureReason: 'BET_FAILED' },
      })
      throw error instanceof BetError
        ? error
        : new BetError('The bet could not be placed. Your wallet was not charged.', 409, 'BET_FAILED')
    }
    return { entry: await loadEntryView(entry.id), slip, mode: slip.mode }
  }

  const normalized = normalizeTzPhone(input.phone)
  if (!normalized.ok) {
    throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'BAD_PHONE')
  }

  if (slip.mode === 'SANDBOX') {
    const entryUserId = await resolveEntryUserId(input.userId, normalized.phone)
    const entry = await prisma.adminBetEntry.create({
      data: {
        slipId: record.id,
        userId: entryUserId,
        phone: normalized.phone,
        stakeMinor,
        selections: slip.selections as unknown as Prisma.InputJsonValue,
        totalOdds: slip.totalOdds,
        status: 'PAID',
        provider: 'sandbox',
        paidAt: now,
      },
    })
    if (!input.userId) {
      await prisma.$transaction(tx =>
        creditWallet(tx, {
          userId: entryUserId,
          amountMinor: stakeMinor,
          type: 'DEPOSIT',
          reference: `slip:${record.code}:entry:${entry.id}:sandbox-float`,
          note: 'Guest stake',
          metadata: { mode: 'SANDBOX' },
        }),
      )
    }
    await placeAdminSlipBet({ entryId: entry.id, now })
    return { entry: await loadEntryView(entry.id), slip, mode: slip.mode }
  }

  if (!settloApiKeyConfigured()) {
    throw new BetError(
      'Mobile-money payments are not configured on this server yet. Add funds to your wallet or try again later.',
      503,
      'PAYMENT_UNAVAILABLE',
    )
  }

  const order = await createSettloOrder({
    phone: normalized.phone,
    amountMinor: stakeMinor,
    currency: 'TZS',
    description: `SpotibetBet slip ${record.code}`,
  })

  if (!order.success || !order.orderId) {
    throw new BetError(order.error ?? 'Could not start the payment. Please try again.', 502, 'PAYMENT_FAILED')
  }

  const entryUserId = await resolveEntryUserId(input.userId, normalized.phone)
  const entry = await prisma.adminBetEntry.create({
    data: {
      slipId: record.id,
      userId: entryUserId,
      phone: normalized.phone,
      stakeMinor,
      selections: slip.selections as unknown as Prisma.InputJsonValue,
      totalOdds: slip.totalOdds,
      status: 'PENDING',
      provider: SETTLO_PROVIDER_NAME,
      providerOrderId: order.orderId,
    },
  })

  return { entry: entryView(entry), slip, mode: slip.mode }
}

export async function refreshSlipPaymentEntry(entryId: string): Promise<SlipPaymentEntryView> {
  const entry = await prisma.adminBetEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  }

  if (entry.status === 'PENDING' && entry.providerOrderId && entry.provider === SETTLO_PROVIDER_NAME) {
    const result = await getSettloPayment(entry.providerOrderId)
    const outcome = mapSettloState(result.status)
    if (result.success && outcome === 'PAID') {
      const updated = await markEntryPaid(entry.id)
      await placeEntryBet(updated.id)
      return loadEntryView(entry.id)
    }
    if (result.success && outcome === 'FAILED') {
      const updated = await prisma.adminBetEntry.update({
        where: { id: entry.id },
        data: { status: 'FAILED', failureReason: result.status ?? 'FAILED' },
      })
      return entryView(updated)
    }
  }

  if (entry.status === 'PAID' && entry.userId && !entry.ticketId) {
    await placeEntryBet(entry.id)
    return loadEntryView(entry.id)
  }

  return loadEntryView(entry.id)
}

export async function applySlipPaymentEvent(
  event: SettloWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }

  const entry = await prisma.adminBetEntry.findUnique({
    where: { providerOrderId: event.orderId },
  })
  if (!entry) return { handled: false }

  const outcome = mapSettloState(event.status)
  if (outcome === 'PAID') {
    if (entry.status !== 'PAID') {
      const updated = await markEntryPaid(entry.id)
      await placeEntryBet(updated.id)
    } else if (entry.userId && !entry.ticketId) {
      await placeEntryBet(entry.id)
    }
  } else if (outcome === 'FAILED' && entry.status === 'PENDING') {
    await prisma.adminBetEntry.update({
      where: { id: entry.id },
      data: { status: 'FAILED', failureReason: event.status ?? 'FAILED' },
    })
  }

  return { handled: true }
}

export async function retrySlipEntry(entryId: string): Promise<SlipPaymentEntryView> {
  const entry = await prisma.adminBetEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  }
  if (entry.ticketId) return loadEntryView(entry.id)
  if (!entry.userId) {
    throw new BetError(
      'This payment is not linked to an account, so a ticket cannot be placed.',
      409,
      'ENTRY_NO_USER',
    )
  }

  if (entry.status === 'PAID') {
    await placeEntryBet(entry.id)
  } else if (entry.status === 'FAILED') {
    if (entry.provider !== 'sandbox' && entry.provider !== 'wallet') {
      if (entry.provider !== SETTLO_PROVIDER_NAME || !entry.providerOrderId) {
        throw new BetError('This payment cannot be retried.', 409, 'NOT_RETRYABLE')
      }
      const result = await getSettloPayment(entry.providerOrderId)
      if (!result.success || mapSettloState(result.status) !== 'PAID') {
        throw new BetError(
          'The payment was not confirmed, so the bet cannot be placed.',
          409,
          'PAYMENT_NOT_CONFIRMED',
        )
      }
    }
    await prisma.adminBetEntry.update({
      where: { id: entry.id },
      data: {
        status: 'PAID',
        paidAt: entry.paidAt ?? new Date(),
        failureReason: null,
        placementStartedAt: null,
      },
    })
    await placeEntryBet(entry.id)
  } else {
    throw new BetError('This entry is not ready to retry.', 409, 'NOT_RETRYABLE')
  }

  const fresh = await prisma.adminBetEntry.findUniqueOrThrow({ where: { id: entry.id } })
  if (!fresh.ticketId) {
    throw new BetError(
      fresh.failureReason
        ? `The bet could not be placed (${fresh.failureReason}).`
        : 'The bet could not be placed. Nothing was charged twice.',
      409,
      fresh.failureReason ?? 'PLACEMENT_FAILED',
    )
  }
  return loadEntryView(entry.id)
}

export async function getSlipEntryForCode(
  code: string,
  entryId: string,
): Promise<SlipPaymentEntryView> {
  const slip = await getAdminBetSlipByCode(code)
  const entry = await prisma.adminBetEntry.findFirst({
    where: { id: entryId, slip: { code: slip.code } },
  })
  if (!entry) throw new BetError('That payment could not be found.', 404, 'ENTRY_NOT_FOUND')
  return refreshSlipPaymentEntry(entry.id)
}

export async function listEntriesForSlip(code: string) {
  const slip = await prisma.adminBetSlip.findUnique({ where: { code: code.toUpperCase() } })
  if (!slip) return []
  const entries = await prisma.adminBetEntry.findMany({
    where: { slipId: slip.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const ticketIds = entries
    .map(entry => entry.ticketId)
    .filter((id): id is string => Boolean(id))
  const tickets =
    ticketIds.length > 0
      ? await prisma.betTicket.findMany({
          where: { id: { in: ticketIds } },
          select: { id: true, code: true },
        })
      : []
  const codeByTicket = new Map(tickets.map(ticket => [ticket.id, ticket.code]))
  return entries.map(entry => ({
    ...entryView(entry, entry.ticketId ? codeByTicket.get(entry.ticketId) ?? null : null),
    phoneMasked: maskPhone(entry.phone),
  }))
}

export { toAdminSlipView }
