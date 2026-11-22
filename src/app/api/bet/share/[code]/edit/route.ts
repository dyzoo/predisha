import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { apiError, json } from '@/lib/api'
import { canUseSpecialBetTools } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { computeTicketTotals } from '@/lib/bet/bets'
import { BetError, handleBetError } from '@/lib/bet/errors'
import { formatKickoffLabel } from '@/lib/bet/format'
import { guardMutation, readJson } from '@/lib/bet/security'
import { assertBetStakeMinor, toAdminSlipView } from '@/lib/bet/slips'
import { MAX_SELECTIONS, MAX_STAKE_MINOR, MIN_STAKE_MINOR, type TicketSelection } from '@/lib/bet/types'
import { prisma } from '@/lib/prisma'

const isoString = z.string().min(1).refine(
  value => !Number.isNaN(new Date(value).getTime()),
  'Enter a valid date.',
)

const selectionSchema = z.object({
  fixtureId: z.string().min(1).max(200),
  fixtureLabel: z.string().min(1).max(240),
  competition: z.string().max(160).nullable().optional(),
  marketId: z.string().min(1).max(120),
  marketName: z.string().min(1).max(160),
  selectionId: z.string().min(1).max(120),
  selectionLabel: z.string().min(1).max(160),
  odds: z.number().finite().min(1.01).max(1000),
  kickoffIso: isoString.nullable().optional(),
})

const editSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  stakeMinor: z.number().int().min(MIN_STAKE_MINOR).max(MAX_STAKE_MINOR).optional(),
  selections: z.array(selectionSchema).min(1).max(MAX_SELECTIONS).optional(),
  manualKickoffAt: isoString.nullable().optional(),
  republish: z.boolean().optional(),
})

type SelectionEdit = z.infer<typeof selectionSchema>

function parseSelections(value: Prisma.JsonValue): TicketSelection[] {
  if (!Array.isArray(value)) return []
  return value as unknown as TicketSelection[]
}

function buildSelections(
  edits: SelectionEdit[],
  existing: TicketSelection[],
): TicketSelection[] {
  const byKey = new Map(
    existing.map(selection => [
      `${selection.fixtureId}:${selection.marketId}:${selection.selectionId}`,
      selection,
    ]),
  )
  const fixtures = new Set<string>()

  const selections = edits.map(edit => {
    if (fixtures.has(edit.fixtureId)) {
      throw new BetError('Choose only one selection per fixture.', 422, 'DUPLICATE_FIXTURE')
    }
    fixtures.add(edit.fixtureId)
    const key = `${edit.fixtureId}:${edit.marketId}:${edit.selectionId}`
    const base = byKey.get(key)
    const kickoffIso = edit.kickoffIso ?? base?.kickoffIso ?? new Date().toISOString()
    return {
      fixtureId: edit.fixtureId,
      fixtureLabel: edit.fixtureLabel.trim(),
      competition: (edit.competition ?? base?.competition ?? 'Shared selection').trim() || 'Shared selection',
      kickoffIso,
      kickoffLabel: formatKickoffLabel(kickoffIso),
      marketId: edit.marketId,
      marketName: edit.marketName.trim(),
      selectionId: edit.selectionId,
      selectionLabel: edit.selectionLabel.trim(),
      odds: Math.round(edit.odds * 100) / 100,
      probability: base?.probability ?? 0.5,
      result: 'PENDING',
      finalScore: null,
      demoResult: false,
    } as TicketSelection
  })

  return selections.sort(
    (left, right) => new Date(left.kickoffIso).getTime() - new Date(right.kickoffIso).getTime(),
  )
}

function resetSelectionResults(selections: TicketSelection[]): TicketSelection[] {
  return selections.map(selection => ({
    ...selection,
    result: 'PENDING',
    finalScore: null,
    demoResult: false,
  }))
}

function shiftPastKickoffs(
  selections: TicketSelection[],
  kickoffAt: Date,
  now: Date,
): TicketSelection[] {
  const nextKickoffIso = kickoffAt.toISOString()
  return selections.map(selection => {
    const current = new Date(selection.kickoffIso).getTime()
    if (Number.isFinite(current) && current > now.getTime()) return selection
    return {
      ...selection,
      kickoffIso: nextKickoffIso,
      kickoffLabel: formatKickoffLabel(nextKickoffIso),
      ...(selection.simulation
        ? {
            simulation: {
              ...selection.simulation,
              liveStartedAt: nextKickoffIso,
              kickoffIso: nextKickoffIso,
            },
          }
        : {}),
    }
  })
}

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    guardMutation(request, 'share-edit')
    const viewer = await getViewer()
    if (!viewer.userId) return apiError('Sign in to continue.', 401)
    if (!canUseSpecialBetTools(viewer)) {
      return apiError('Special bet tools are not enabled for this account.', 403)
    }

    const { code } = await params
    const normalized = code.trim().toUpperCase()
    const input = await readJson(request, editSchema)
    const actorId = viewer.userId
    const ipAddress = requestIp(request)
    const now = new Date()

    const slip = await prisma.adminBetSlip.findUnique({ where: { code: normalized } })
    if (slip) {
      const republish = input.republish === true
      const stakeMinor = input.stakeMinor ?? slip.stakeMinor
      await assertBetStakeMinor(stakeMinor)
      const existing = parseSelections(slip.selections)
      const manualKickoff =
        input.manualKickoffAt === undefined
          ? undefined
          : input.manualKickoffAt
            ? new Date(input.manualKickoffAt)
            : null
      const reopenKickoffAt =
        manualKickoff && manualKickoff.getTime() > now.getTime()
          ? manualKickoff
          : new Date(now.getTime() + 24 * 60 * 60_000)
      const editedSelections = input.selections
        ? buildSelections(input.selections, existing)
        : republish
          ? resetSelectionResults(existing)
          : existing
      const selections = republish
        ? shiftPastKickoffs(editedSelections, reopenKickoffAt, now)
        : editedSelections
      if (selections.length === 0) {
        return apiError('A slip needs at least one selection.', 422)
      }
      const totals = computeTicketTotals(stakeMinor, selections)

      const data: Prisma.AdminBetSlipUpdateInput = {
        stakeMinor,
        selections: selections as unknown as Prisma.InputJsonValue,
        totalOdds: totals.totalOdds,
        potentialReturnMinor: totals.potentialReturnMinor,
      }
      if (input.title !== undefined) data.title = input.title?.trim().slice(0, 120) || null
      if (manualKickoff !== undefined) {
        data.timeMode = 'MANUAL'
        data.manualKickoffAt = manualKickoff
        data.liveStartedAt = null
        data.autoFreezeAt = manualKickoff ?? new Date(now.getTime() + 24 * 60 * 60_000)
        data.status = 'OPEN'
        data.freezeReason = null
        data.frozenAt = null
        data.frozenBy = actorId
      }
      if (republish) {
        if (slip.timeMode === 'MANUAL') data.manualKickoffAt = reopenKickoffAt
        data.liveStartedAt = null
        data.autoFreezeAt = reopenKickoffAt
        data.status = 'OPEN'
        data.freezeReason = null
        data.frozenAt = null
        data.frozenBy = actorId
      }

      const updated = await prisma.$transaction(async tx => {
        const next = await tx.adminBetSlip.update({ where: { id: slip.id }, data })
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin.slip.special-edit',
            target: slip.code,
            ipAddress,
            metadata: {
              title: input.title ?? null,
              stakeMinor,
              selectionCount: selections.length,
              manualKickoffAt: manualKickoff?.toISOString() ?? null,
              previousStatus: slip.status,
              republished: republish,
            },
          },
        })
        return next
      })

      return json({
        slip: toAdminSlipView(updated),
        shareUrl: `/bet/share/${updated.code}`,
      })
    }

    const share = await prisma.betShareCode.findUnique({ where: { code: normalized } })
    if (!share) {
      return apiError('That share code does not exist.', 404)
    }
    if (input.stakeMinor !== undefined) await assertBetStakeMinor(input.stakeMinor)
    const existing = parseSelections(share.selections)
    const selections = input.selections ? buildSelections(input.selections, existing) : existing
    if (selections.length === 0) return apiError('A slip needs at least one selection.', 422)
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000)

    await prisma.$transaction(async tx => {
      await tx.betShareCode.update({
        where: { id: share.id },
        data: {
          selections: selections as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
      })
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'admin.share.special-edit',
          target: share.code,
          ipAddress,
          metadata: {
            selectionCount: selections.length,
            stakeMinor: input.stakeMinor ?? null,
            title: input.title ?? null,
            manualKickoffAt: input.manualKickoffAt ?? null,
          },
        },
      })
    })

    return json({
      share: { code: share.code, selections, expiresAt: expiresAt.toISOString(), stale: false },
    })
  } catch (error) {
    return handleBetError(error)
  }
}
