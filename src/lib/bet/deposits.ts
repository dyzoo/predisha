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
import { creditWallet } from './wallet'

const SUCCESS_STATUSES = new Set(['completed', 'success', 'succeeded', 'paid', 'confirmed'])
const FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'expired'])
const MIN_DEPOSIT_TZS = 1_000
const MAX_DEPOSIT_TZS = 1_000_000

export interface DepositOrderView {
  orderId: string
  status: string
  amountMinor: number
  currency: string
  paid: boolean
  message: string
}

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
}

function orderView(order: {
  orderId: string
  status: string
  amountMinor: number
  currency: string
}): DepositOrderView {
  const paid = order.status === 'PAID'
  return {
    orderId: order.orderId,
    status: order.status,
    amountMinor: order.amountMinor,
    currency: order.currency,
    paid,
    message: paid
      ? 'Payment confirmed. Your betting wallet has been credited.'
      : order.status === 'FAILED'
        ? 'The payment was not completed. You can try again.'
        : 'Approve the mobile-money prompt on your phone to finish the deposit.',
  }
}

export async function startWalletDeposit(input: {
  userId: string
  amountMinor: number
  phone: string
}): Promise<DepositOrderView> {
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor < MIN_DEPOSIT_TZS ||
    input.amountMinor > MAX_DEPOSIT_TZS
  ) {
    throw new BetError(
      `Deposit must be between ${MIN_DEPOSIT_TZS} and ${MAX_DEPOSIT_TZS} TZS.`,
      422,
      'BAD_AMOUNT',
    )
  }
  if (!harakapayApiKeyConfigured()) {
    throw new BetError(
      'Mobile-money payments are not configured on this server yet. The operator must add HARAKAPAY_API_KEY and restart the app, or switch the platform to Sandbox mode for test deposits.',
      503,
      'PAYMENT_UNAVAILABLE',
    )
  }

  const normalized = normalizeTzPhone(input.phone)
  if (!normalized.ok) {
    throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'BAD_PHONE')
  }

  const order = await createHarakaPayOrder({
    phone: normalized.phone,
    amountMinor: input.amountMinor,
    currency: 'TZS',
    description: 'PredishaBet wallet deposit',
    webhookUrl: `${appUrl()}/api/webhooks/${HARAKAPAY_PROVIDER_NAME}`,
  })

  if (!order.success || !order.orderId) {
    throw new BetError(order.error ?? 'Could not start the deposit. Please try again.', 502, 'PAYMENT_FAILED')
  }

  const record = await prisma.betPaymentOrder.create({
    data: {
      userId: input.userId,
      kind: 'DEPOSIT',
      amountMinor: input.amountMinor,
      currency: 'TZS',
      provider: HARAKAPAY_PROVIDER_NAME,
      orderId: order.orderId,
      status: 'PENDING',
    },
  })

  return orderView(record)
}

async function completeDeposit(orderId: string): Promise<void> {
  await prisma.$transaction(async tx => {
    const order = await tx.betPaymentOrder.findUnique({ where: { orderId } })
    if (!order || order.status === 'PAID') return

    await creditWallet(tx, {
      userId: order.userId,
      amountMinor: order.amountMinor,
      type: 'DEPOSIT',
      reference: `hpay:${order.orderId}`,
      note: 'HarakaPay deposit',
      metadata: { provider: HARAKAPAY_PROVIDER_NAME, orderId: order.orderId },
    })

    await tx.betPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'PAID', completedAt: new Date() },
    })
  })
}

export async function refreshWalletDeposit(
  userId: string,
  orderId: string,
): Promise<DepositOrderView> {
  const order = await prisma.betPaymentOrder.findFirst({ where: { orderId, userId } })
  if (!order) throw new BetError('That deposit could not be found.', 404, 'ORDER_NOT_FOUND')

  if (order.status === 'PENDING') {
    const result = await getHarakaPayOrderStatus(orderId)
    const status = (result.status ?? '').toLowerCase()
    if (SUCCESS_STATUSES.has(status)) {
      await completeDeposit(orderId)
    } else if (FAILURE_STATUSES.has(status)) {
      await prisma.betPaymentOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      })
    }
  }

  const fresh = await prisma.betPaymentOrder.findUniqueOrThrow({ where: { orderId } })
  return orderView(fresh)
}

export async function applyDepositPaymentEvent(
  event: HarakaPayWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }
  const order = await prisma.betPaymentOrder.findUnique({ where: { orderId: event.orderId } })
  if (!order) return { handled: false }

  const status = (event.status ?? '').toLowerCase()
  if (SUCCESS_STATUSES.has(status)) {
    await completeDeposit(event.orderId)
  } else if (FAILURE_STATUSES.has(status) && order.status === 'PENDING') {
    await prisma.betPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED' },
    })
  }

  return { handled: true }
}
