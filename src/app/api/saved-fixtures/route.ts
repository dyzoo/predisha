import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { canViewPremium, type Viewer } from '@/lib/auth/entitlements'
import { isSameOrigin } from '@/lib/auth/origin'
import { getViewer, isAuthConfigured } from '@/lib/auth/session'
import { ensureFixturePersisted } from '@/lib/sports/persist'
import { getMatchAnalysis } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { serializeMatchView } from '@/lib/sports/serialize'
import { prisma } from '@/lib/prisma'

const FREE_SAVED_LIMIT = 5

const saveSchema = z.object({ fixtureId: z.string().trim().min(1).max(200) })

function unauthorized(viewer: Viewer): Response | null {
  if (!isAuthConfigured()) {
    return apiError('Accounts are not configured on this deployment yet.', 503)
  }
  if (!viewer.userId) return apiError('Sign in to manage saved matches.', 401)
  return null
}

export async function GET() {
  const viewer = await getViewer()
  const denied = unauthorized(viewer)
  if (denied) return denied

  try {
    const saved = await prisma.savedFixture.findMany({
      where: { userId: viewer.userId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return json({
      data: saved.map(item => ({ fixtureId: item.fixtureId, createdAt: item.createdAt })),
      meta: { limit: canViewPremium(viewer) ? null : FREE_SAVED_LIMIT },
    })
  } catch {
    return apiError('Saved matches are temporarily unavailable.', 503)
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)
  const viewer = await getViewer()
  const denied = unauthorized(viewer)
  if (denied) return denied

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return apiError('Invalid JSON body.', 400)
  }
  const parsed = saveSchema.safeParse(payload)
  if (!parsed.success) return apiError('A valid fixtureId is required.', 422)

  const { analysis } = await getMatchAnalysis(parsed.data.fixtureId)
  if (!analysis) return apiError('Fixture not found.', 404)

  try {
    await ensureFixturePersisted(analysis)

    const alreadySaved = await prisma.savedFixture.findUnique({
      where: {
        userId_fixtureId: { userId: viewer.userId!, fixtureId: parsed.data.fixtureId },
      },
    })
    if (!alreadySaved && !canViewPremium(viewer)) {
      const count = await prisma.savedFixture.count({ where: { userId: viewer.userId! } })
      if (count >= FREE_SAVED_LIMIT) {
        return apiError('The free saved-match limit has been reached.', 403, {
          limit: FREE_SAVED_LIMIT,
        })
      }
    }

    const saved = await prisma.savedFixture.upsert({
      where: {
        userId_fixtureId: { userId: viewer.userId!, fixtureId: parsed.data.fixtureId },
      },
      update: {},
      create: { userId: viewer.userId!, fixtureId: parsed.data.fixtureId },
    })
    return json({
      data: {
        fixtureId: saved.fixtureId,
        createdAt: saved.createdAt,
        match: serializeMatchView(toMatchView(analysis), { includeExplanation: false }),
      },
    })
  } catch {
    return apiError('Could not save this fixture right now.', 503)
  }
}
