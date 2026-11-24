import { prisma } from '@/lib/prisma'
import { formatTzs } from '@/lib/bet/format'
import { maskTzPhone, normalizeTzPhone } from '@/lib/bet/phone'

const DEFAULT_BASE_URL = 'https://messaging-service.co.tz'
const DEFAULT_SENDER_ID = 'NEXTSMS'
const REQUEST_TIMEOUT_MS = 8_000

export type BetTransactionSmsSource = 'deposit' | 'shared_slip' | 'aviator'

export interface NextSmsSendInput {
  to: string[]
  text: string
  reference?: string
}

export interface NextSmsSendResult {
  success: boolean
  sentCount: number
  failedCount: number
  error: string | null
  messageIds: string[]
}

export interface BetTransactionSmsInput {
  userId: string
  amountMinor: number
  source: BetTransactionSmsSource
  reference?: string
}

function apiKey(): string {
  const key = process.env.NEXTSMS_API_KEY?.trim() || process.env.NEXTSMS_API?.trim()
  return key || '417d9c15466a201c60d6233d4137d30a'
}

function baseUrl(): string {
  const value = process.env.NEXTSMS_BASE_URL?.trim() ?? DEFAULT_BASE_URL
  return value.replace(/\/+$/, '')
}

function senderId(): string {
  return process.env.NEXTSMS_SENDER_ID?.trim() ?? DEFAULT_SENDER_ID
}

export function nextsmsApiKeyConfigured(): boolean {
  return apiKey().trim().length > 0
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length >= 12) return digits
  if (digits.startsWith('0') && digits.length > 9) return `255${digits.slice(1)}`
  return digits
}

export function normalizeNextSmsNumbers(numbers: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const number of numbers) {
    const normalized = normalizePhone(number)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

export async function sendNextSms(input: NextSmsSendInput): Promise<NextSmsSendResult> {
  const to = normalizeNextSmsNumbers(input.to)
  if (to.length === 0) {
    return { success: false, sentCount: 0, failedCount: 0, error: 'No valid recipient numbers provided.', messageIds: [] }
  }

  try {
    const response = await fetch(`${baseUrl()}/api/sms/v2/text/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        from: senderId(),
        to,
        text: input.text,
        ...(input.reference ? { reference: input.reference } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const messages = Array.isArray(payload?.messages) ? (payload.messages as Array<Record<string, unknown>>) : []
    const failed = messages.filter(
      message => !message || (message.status as { groupName?: string } | undefined)?.groupName === 'REJECTED',
    )
    const rejectionReasons = failed
      .map(message => {
        const status = message?.status as
          | { name?: string; description?: string; groupName?: string }
          | undefined
        return [status?.name, status?.description].filter(Boolean).join(': ')
      })
      .filter(Boolean)
    const messageIds = messages.map(message => String(message?.messageId ?? '')).filter(Boolean)
    const success = response.ok && messages.length > 0 && failed.length === 0

    return {
      success,
      sentCount: messages.length - failed.length,
      failedCount: failed.length,
      error:
        failed.length > 0
          ? rejectionReasons.length > 0
            ? rejectionReasons.join('; ')
            : 'One or more recipient numbers were rejected.'
          : null,
      messageIds,
    }
  } catch {
    return { success: false, sentCount: 0, failedCount: to.length, error: 'Unable to reach the NextSMS API.', messageIds: [] }
  }
}

export function buildBetTransactionSms(input: {
  amountMinor: number
  source: BetTransactionSmsSource
}): string {
  const amountLabel = formatTzs(input.amountMinor)
  if (input.source === 'deposit') {
    return `${amountLabel} was added to your account from your deposit.`
  }
  const stakeLabel =
    input.source === 'shared_slip' ? 'your bet slip' : input.source === 'aviator' ? 'Aviator' : 'your bet'
  return `${amountLabel} was staked on ${stakeLabel}.`
}

export async function sendBetTransactionSms(
  input: BetTransactionSmsInput,
): Promise<NextSmsSendResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true },
  })
  const phone = user?.phone ? normalizeTzPhone(user.phone) : null
  if (!phone?.ok) {
    await prisma.adminAuditLog
      .create({
        data: {
          action: 'bet.sms.skipped',
          target: input.reference ?? 'bet',
          metadata: {
            userId: input.userId,
            amountMinor: input.amountMinor,
            source: input.source,
            reason: 'NO_VALID_PHONE',
          },
        },
      })
      .catch(() => undefined)
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      error: 'The user has no valid mobile number.',
      messageIds: [],
    }
  }

  const result = await sendNextSms({
    to: [phone.phone],
    text: buildBetTransactionSms(input),
    reference: input.reference,
  })

  await prisma.adminAuditLog
    .create({
      data: {
        action: result.success ? 'bet.sms.sent' : 'bet.sms.failed',
        target: input.reference ?? 'bet',
        metadata: {
          userId: input.userId,
          phone: maskTzPhone(phone.phone),
          amountMinor: input.amountMinor,
          source: input.source,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          ...(result.error ? { error: result.error } : {}),
          ...(result.messageIds.length > 0 ? { messageIds: result.messageIds } : {}),
        },
      },
    })
    .catch(() => undefined)

  return result
}