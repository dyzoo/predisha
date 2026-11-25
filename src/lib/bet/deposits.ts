import { prisma } from '@/lib/prisma'
import {
  SETTLO_PROVIDER_NAME,
  createSettloOrder,
  getSettloPayment,
  mapSettloState,
  settloApiKeyConfigured,
  type SettloWebhookEvent,
} from '@/lib/billing/settlopay'
import { getDepositMinMinor } from './deposit-settings'
import { BetError } from './errors'
import { normalizeTzPhone } from './phone'
import { MAX_DEPOSIT_MINOR } from './types'
import { creditWallet } from './wallet'
import { sendBetTransactionSms } from '@/lib/billing/nextsms'

export interface DepositOrderView {
  orderId: string
  status: string
  amountMinor: number
  currency: string
  paid: boolean
  message: string
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
  const minDepositMinor = await getDepositMinMinor()
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor < minDepositMinor ||
    input.amountMinor > MAX_DEPOSIT_MINOR
  ) {
    throw new BetError(
      `Deposit must be between ${minDepositMinor} and ${MAX_DEPOSIT_MINOR} TZS.`,
      422,
      'BAD_AMOUNT',
    )
  }
  if (!settloApiKeyConfigured()) {
    throw new BetError(
      'Mobile-money payments are not configured on this server yet. Add funds from the wallet page or try again later.',
      503,
      'PAYMENT_UNAVAILABLE',
    )
  }

  const normalized = normalizeTzPhone(input.phone)
  if (!normalized.ok) {
    throw new BetError(normalized.error ?? 'Enter a valid mobile number.', 422, 'BAD_PHONE')
  }

  const order = await createSettloOrder({
    phone: normalized.phone,
    amountMinor: input.amountMinor,
    currency: 'TZS',
    description: 'SpotibetBet wallet deposit',
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
      provider: SETTLO_PROVIDER_NAME,
      phone: normalized.phone,
      orderId: order.orderId,
      status: 'PENDING',
    },
  })

  return orderView(record)
}

async function completeDeposit(orderId: string): Promise<void> {
  const completed = await prisma.$transaction(async tx => {
    const order = await tx.betPaymentOrder.findUnique({ where: { orderId } })
    if (!order || order.status === 'PAID') return null

    await creditWallet(tx, {
      userId: order.userId,
      amountMinor: order.amountMinor,
      type: 'DEPOSIT',
      reference: `settlopay:${order.orderId}`,
      note: 'Settlo Pay deposit',
      metadata: { provider: SETTLO_PROVIDER_NAME, orderId: order.orderId },
    })

    await tx.betPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'PAID', completedAt: new Date() },
    })

    return { userId: order.userId, amountMinor: order.amountMinor, orderId: order.orderId }
  })
  if (!completed) return

  await sendBetTransactionSms({
    userId: completed.userId,
    amountMinor: completed.amountMinor,
    source: 'deposit',
    reference: completed.orderId,
  }).catch(() => undefined)
}

export async function refreshWalletDeposit(
  userId: string,
  orderId: string,
): Promise<DepositOrderView> {
  const order = await prisma.betPaymentOrder.findFirst({ where: { orderId, userId } })
  if (!order) throw new BetError('That deposit could not be found.', 404, 'ORDER_NOT_FOUND')

  if (order.status === 'PENDING') {
    const result = await getSettloPayment(orderId)
    const outcome = mapSettloState(result.status)
    if (result.success && outcome === 'PAID') {
      await completeDeposit(orderId)
    } else if (result.success && outcome === 'FAILED') {
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
  event: SettloWebhookEvent,
): Promise<{ handled: boolean }> {
  if (!event.orderId) return { handled: false }
  const order = await prisma.betPaymentOrder.findUnique({ where: { orderId: event.orderId } })
  if (!order) return { handled: false }

  const outcome = mapSettloState(event.status)
  if (outcome === 'PAID') {
    await completeDeposit(event.orderId)
  } else if (outcome === 'FAILED' && order.status === 'PENDING') {
    await prisma.betPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED' },
    })
  }

  return { handled: true }
}
