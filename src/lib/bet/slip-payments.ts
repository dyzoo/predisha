import { prisma } from '@/lib/prisma'
import {
  HARAKAPAY_PROVIDER_NAME,
  createHarakaPayOrder,
  getHarakaPayOrderStatus,
  harakapayApiKeyConfigured,
  type HarakaPayWebhookEvent,
} from '@/lib/billing/harakapay'
import { BetError } from './errors'
import { normalizeTzPhone } from './phone'
import {
  getAdminBetSlipByCode,
  isSlipFrozen,
  maskPhone,
  toAdminSlipView,
  placeAdminSlipBet,
  type AdminBetSlipView,
} from './slips'

const SUCCESS_STATUSES = new Set(['completed', 'success', 'succeeded', 'paid', 'confirmed'])
const FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'expired'])

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

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
}

function entryView(
  entry: {
    id: string
    status: string
    phone: string
    stakeMinor: number
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
      status === 'PAID'
        ? 'Your bet is confirmed. Keep this page and your slip code for reference.'
        : status === 'FAILED'
          ? 'The payment was not completed. You can try again with the same phone number.'
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
  now?: Date
}): Promise<SlipPaymentResult> {
  const now = input.now ?? new Date()
  const slip = await getAdminBetSlipByCode(input.code, now)
  const record = await prisma.adminBetSlip.findUniqueOrThrow({ where: { code: slip.code } })

  if (isSlipFrozen(record, now)) {
    throw new BetError(
      record.freezeReason ??
        'Betting is closed for this slip. One of the matches has started or an administrator paused it.',
      409,
      'SLIP_FROZEN',
      { freezeReason: record.freezeReason, autoFreezeAt: record.autoFreezeAt.toISOString() },
    )
  }

  const normalized = normalizeTzPhone(input.phone)
  if (!normalized.ok) {
    throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'BAD_PHONE')
  }

  if (slip.mode === 'SANDBOX') {
    const entry = await prisma.adminBetEntry.create({
      data: {
        slipId: record.id,
        userId: input.userId ?? null,
        phone: normalized.phone,
        stakeMinor: record.stakeMinor,
        status: 'PAID',
        provider: 'sandbox',
        paidAt: now,
      },
    })
    if (input.userId) {
      await placeAdminSlipBet({ entryId: entry.id, now })
    }
    return { entry: await loadEntryView(entry.id), slip, mode: slip.mode }
  }

  if (!harakapayApiKeyConfigured()) {
    throw new BetError(
      'Card and mobile-money payments are not configured yet. Contact the operator.',
      503,
      'PAYMENT_UNAVAILABLE',
    )
  }

  const order = await createHarakaPayOrder({
    phone: normalized.phone,
    amountMinor: record.stakeMinor,
    currency: 'TZS',
    description: `PredishaBet slip ${record.code}`,
    webhookUrl: `${appUrl()}/api/webhooks/${HARAKAPAY_PROVIDER_NAME}`,
  })

  if (!order.success || !order.orderId) {
    throw new BetError(order.error ?? 'Could not start the payment. Please try again.', 502, 'PAYMENT_FAILED')
  }

  const entry = await prisma.adminBetEntry.create({
    data: {
      slipId: record.id,
      userId: input.userId ?? null,
      phone: normalized.phone,
      stakeMinor: record.stakeMinor,
      status: 'PENDING',
      provider: HARAKAPAY_PROVIDER_NAME,
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

  if (entry.status === 'PENDING' && entry.providerOrderId && entry.provider === HARAKAPAY_PROVIDER_NAME) {
    const result = await getHarakaPayOrderStatus(entry.providerOrderId)
    const status = (result.status ?? '').toLowerCase()
    if (SUCCESS_STATUSES.has(status)) {
      const updated = await markEntryPaid(entry.id)
      await placeEntryBet(updated.id)
      return loadEntryView(entry.id)
    }
    if (FAILURE_STATUSES.has(status)) {
      const updated = await prisma.adminBetEntry.update({
        where: { id: entry.id },
        data: { status: 'FAILED', failureReason: result.error ?? status },
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
  event: HarakaPayWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }

  const entry = await prisma.adminBetEntry.findUnique({
    where: { providerOrderId: event.orderId },
  })
  if (!entry) return { handled: false }

  const status = (event.status ?? '').toLowerCase()
  if (SUCCESS_STATUSES.has(status)) {
    if (entry.status !== 'PAID') {
      const updated = await markEntryPaid(entry.id)
      await placeEntryBet(updated.id)
    } else if (entry.userId && !entry.ticketId) {
      await placeEntryBet(entry.id)
    }
  } else if (FAILURE_STATUSES.has(status) && entry.status === 'PENDING') {
    await prisma.adminBetEntry.update({
      where: { id: entry.id },
      data: { status: 'FAILED', failureReason: status },
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
    if (entry.provider !== 'sandbox') {
      if (entry.provider !== HARAKAPAY_PROVIDER_NAME || !entry.providerOrderId) {
        throw new BetError('This payment cannot be retried.', 409, 'NOT_RETRYABLE')
      }
      const result = await getHarakaPayOrderStatus(entry.providerOrderId)
      const status = (result.status ?? '').toLowerCase()
      if (!SUCCESS_STATUSES.has(status)) {
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