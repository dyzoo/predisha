import { json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { handleBetError } from '@/lib/bet/errors'
import { readJson } from '@/lib/bet/security'
import { adminWinnerCreateSchema } from '@/lib/bet/validation'
import { createWinnerSlip, listWinnerSlips } from '@/lib/bet/winners'

export async function GET() {
  try {
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok') {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }
    return json({ winners: await listWinnerSlips() })
  } catch (error) {
    return handleBetError(error)
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: 'Invalid origin.' }, { status: 403 })
    }
    const access = await getAdminAccess()
    if (access.status === 'unconfigured') {
      return json({ error: 'Admin is not configured on this deployment yet.' }, { status: 503 })
    }
    if (access.status !== 'ok' || !access.viewer.userId) {
      return json({ error: 'Admin access required.' }, { status: 403 })
    }

    const input = await readJson(request, adminWinnerCreateSchema)
    const winner = await createWinnerSlip({
      userId: input.userId,
      title: input.title,
      stakeMinor: input.stakeMinor,
      selections: input.selections,
      note: input.note,
      createdBy: access.viewer.userId,
      now: input.date ? new Date(input.date) : new Date(),
    })

    return json(
      {
        winner,
        shareUrl: `/bet/winner/${winner.code}`,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleBetError(error)
  }
}
