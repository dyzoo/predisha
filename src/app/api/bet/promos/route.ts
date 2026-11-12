import { json } from '@/lib/api'
import { handleBetError } from '@/lib/bet/errors'
import { listPromos } from '@/lib/bet/promos'
import { getViewer } from '@/lib/auth/session'

export async function GET() {
  try {
    const viewer = await getViewer()
    const promos = await listPromos(viewer.userId ?? undefined)
    return json({ promos, sandbox: true })
  } catch (error) {
    return handleBetError(error)
  }
}
