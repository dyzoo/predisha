import { connection } from 'next/server'
import { apiError, json } from '@/lib/api'
import { getBillingProvider } from '@/lib/billing/provider'
import { applyBillingWebhookEvent } from '@/lib/billing/webhook'

const SIGNATURE_HEADERS = [
  'x-harakapay-signature',
  'x-hpk-signature',
  'x-haraka-signature',
  'x-signature',
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  await connection()

  const { provider: providerId } = await params
  const provider = getBillingProvider()
  if (providerId !== provider.name) {
    return apiError('Unknown billing provider.', 404)
  }

  const rawBody = await request.text()
  const signature = SIGNATURE_HEADERS.map(header => request.headers.get(header)).find(Boolean) ?? null
  const event = await provider.verifyWebhook(rawBody, signature)
  if (!event) {
    return apiError('Invalid billing webhook signature.', 401)
  }

  const result = await applyBillingWebhookEvent(event)
  return json({ data: { received: true, handled: result.handled } })
}
