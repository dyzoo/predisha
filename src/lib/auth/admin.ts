import { canViewAdmin, type Viewer } from './entitlements'
import { getViewer, isAuthConfigured } from './session'

export type AdminAccess =
  | { status: 'ok'; viewer: Viewer }
  | { status: 'unconfigured' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; viewer: Viewer }

export async function getAdminAccess(): Promise<AdminAccess> {
  if (!isAuthConfigured()) return { status: 'unconfigured' }
  const viewer = await getViewer()
  if (!viewer.userId) return { status: 'unauthenticated' }
  if (!canViewAdmin(viewer)) return { status: 'forbidden', viewer }
  return { status: 'ok', viewer }
}
