import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { canUseFreePreview, canViewPremium, shouldClaimFreePreview } from '@/lib/auth/entitlements'
import {
  consumeFreePreview,
  FreePreviewUnavailableError,
  getFreePreviewState,
} from '@/lib/auth/free-preview'
import { isSameOrigin } from '@/lib/auth/origin'
import { clientKey, rateLimit } from '@/lib/auth/rate-limit'
import { getViewer } from '@/lib/auth/session'
import { buildPredictionSlip } from '@/lib/predictions/builder'
import { defaultCurrency, normalizeCurrency } from '@/lib/predictions/builder-types'
import { savePredictionSlip } from '@/lib/predictions/history'
import { prisma } from '@/lib/prisma'
import { getMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'

const buildSchema = z.object({
  stake: z.number().finite().positive().max(1_000_000_000).optional().default(1),
  risk: z.enum(['conservative', 'balanced', 'aggressive']).default('balanced'),
  odds: z.number().finite().min(1).max(1_000_000).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  timeRange: z.enum(['day', 'week', 'month']).optional().default('week'),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const limit = rateLimit(clientKey(request, 'prediction-build'), 12, 60_000)
  if (!limit.ok) {
    return apiError('Too many requests. Try again shortly.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = buildSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Enter a valid stake amount.', 422, {
      issues: parsed.error.issues.map(issue => issue.message),
    })
  }

  const viewer = await getViewer()
  const { analyses, dataset } = await getMatchAnalyses()

  if (!viewer.userId) {
    return apiError('Sign in to build a prediction.', 401)
  }

  const premium = canViewPremium(viewer)
  const freePreviewState =
    viewer.userId && !premium && !dataset.isDemo
      ? await getFreePreviewState(viewer.userId)
      : null

  if (
    freePreviewState &&
    !canUseFreePreview({
      premium,
      demo: dataset.isDemo,
      used: freePreviewState.used,
    })
  ) {
    return apiError(
      'Your free prediction preview has already been used. Subscribe to premium to keep building slips.',
      402,
      { code: 'FREE_PREVIEW_USED' },
    )
  }

  const timeRange = parsed.data.timeRange ?? 'week'
  const now = new Date()
  let fromDate = new Date(now)
  let toDate = new Date(now)
  if (timeRange === 'day') {
    toDate.setHours(23, 59, 59, 999)
  } else if (timeRange === 'week') {
    toDate.setDate(toDate.getDate() + 7)
    toDate.setHours(23, 59, 59, 999)
  } else if (timeRange === 'month') {
    toDate.setMonth(toDate.getMonth() + 1)
    toDate.setHours(23, 59, 59, 999)
  }

  const maxSelections = premium || dataset.isDemo ? 20 : 5
  const filteredAnalyses = analyses.filter(a => {
    const kickoff = a.fixture.kickoffUtc.getTime()
    return kickoff >= fromDate.getTime() && kickoff <= toDate.getTime()
  })
  const result = buildPredictionSlip(
    filteredAnalyses.map(analysis => toMatchView(analysis)),
    {
      stake: parsed.data.stake,
      risk: parsed.data.risk,
      odds: parsed.data.odds ?? null,
      maxSelections,
      currency: normalizeCurrency(parsed.data.currency ?? defaultCurrency()),
      demo: dataset.isDemo,
      premium,
      limited: !premium && !dataset.isDemo,
    },
  )

  if (!result) {
    return apiError(
      'No upcoming fixtures currently pass the model quality gates. Try again after the next data sync.',
      422,
      { demo: dataset.isDemo },
    )
  }

  let slipId: string | undefined
  if (viewer.userId) {
    slipId = await savePredictionSlip(viewer.userId, result)

    if (
      shouldClaimFreePreview({
        premium,
        demo: dataset.isDemo,
        signedIn: true,
      })
    ) {
      try {
        await consumeFreePreview(viewer.userId, slipId)
      } catch (error) {
        await prisma.predictionSlip
          .delete({ where: { id: slipId } })
          .catch(() => undefined)
        if (error instanceof FreePreviewUnavailableError) {
          return apiError(
            'Your free prediction preview has already been used. Subscribe to premium to keep building slips.',
            402,
            { code: 'FREE_PREVIEW_USED' },
          )
        }
        throw error
      }
    }
  }

  return json({
    data: { ...result, slipId },
    meta: {
      demo: dataset.isDemo,
      saved: Boolean(slipId),
      freePreview: freePreviewState
        ? { claimedAt: freePreviewState.claimedAt, used: true }
        : null,
    },
  })
}
