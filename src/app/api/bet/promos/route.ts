import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { listPromos } from '@/lib/bet/promos'
import { getViewer } from '@/lib/auth/session'
import { getBetMode } from '@/lib/bet/mode'

export async function GET() {
  try {
    const viewer = await getViewer()
    const promos = await listPromos(viewer.userId ?? undefined)
    return json({ promos, mode: await getBetMode() })
  } catch (error) {
    return handleBetError(error)
  }
}
