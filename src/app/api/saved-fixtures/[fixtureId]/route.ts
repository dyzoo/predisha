import { apiError, json } from '@/lib/api'
import { isSameOrigin } from '@/lib/auth/origin'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  const viewer = await getViewer()
  if (!viewer.userId) return apiError('Sign in to manage saved matches.', 401)

  const { fixtureId } = await params
  try {
    await prisma.savedFixture.deleteMany({
      where: { userId: viewer.userId, fixtureId },
    })
    return json({ data: { fixtureId, saved: false } })
  } catch {
    return apiError('Could not remove this fixture right now.', 503)
  }
}
