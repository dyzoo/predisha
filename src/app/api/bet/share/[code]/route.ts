import { apiError, json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { loadShareCode } from '@/lib/bet/share'
import { toAdminSlipView } from '@/lib/bet/slips'
import { prisma } from '@/lib/prisma'
import { shareCodeSchema } from '@/lib/bet/validation'
import { getBetMode } from '@/lib/bet/mode'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) return apiError('Enter a valid 6-character share code.', 422)
    const slip = await prisma.adminBetSlip.findUnique({ where: { code: parsed.data } })
    if (slip) {
      const view = toAdminSlipView(slip, new Date())
      return json({
        share: { code: view.code, selections: view.selections, expiresAt: view.autoFreezeAt, stale: false },
        slip: view,
        mode: await getBetMode(),
      })
    }
    const share = await loadShareCode(parsed.data, new Date())
    return json({ share, slip: null, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}