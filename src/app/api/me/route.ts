import { connection } from 'next/server'
import { json } from '@/lib/api'
import { toClientViewer } from '@/lib/auth/entitlements'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'

export async function GET() {
  await connection()
  const viewer = await getViewer()
  return json({
    data: toClientViewer(viewer),
    meta: { authConfigured: isAuthConfigured() },
  })
}
