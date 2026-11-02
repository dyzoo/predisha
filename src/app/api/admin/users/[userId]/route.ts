import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getAdminAccess } from '@/lib/auth/admin'
import { isSameOrigin } from '@/lib/auth/origin'

const DAY_MS = 24 * 60 * 60 * 1000

const updateUserSchema = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  subscriptionStatus: z
    .enum(['INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'])
    .optional(),
  planId: z.enum(['weekly', 'monthly']).optional(),
})

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

function subscriptionWindow(interval: 'WEEKLY' | 'MONTHLY'): { start: Date; end: Date } {
  const now = Date.now()
  const length = interval === 'WEEKLY' ? 7 * DAY_MS : 30 * DAY_MS
  return { start: new Date(now), end: new Date(now + length) }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request)) return apiError('Invalid origin.', 403)

  const access = await getAdminAccess()
  if (access.status === 'unconfigured') {
    return apiError('Admin is not configured on this deployment yet.', 503)
  }
  if (access.status !== 'ok') return apiError('Admin access required.', 403)

  const { userId } = await params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return apiError('Invalid JSON body.', 400)
  }

  const parsed = updateUserSchema.safeParse(payload)
  if (!parsed.success) return apiError('Check the submitted values and try again.', 422)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })
  if (!target) return apiError('User not found.', 404)

  const ipAddress = requestIp(request)
  const actorId = access.viewer.userId
  const changes: string[] = []

  try {
    if (parsed.data.role && parsed.data.role !== target.role) {
      if (target.id === actorId && parsed.data.role === 'USER') {
        return apiError('You cannot remove your own admin access.', 400)
      }
      await prisma.user.update({
        where: { id: target.id },
        data: { role: parsed.data.role },
      })
      await prisma.adminAuditLog.create({
        data: {
          actorId,
          action: 'user.role.update',
          target: target.email,
          ipAddress,
          metadata: { from: target.role, to: parsed.data.role },
        },
      })
      changes.push('role')
    }

    if (parsed.data.subscriptionStatus) {
      const nextStatus = parsed.data.subscriptionStatus

      if (nextStatus === 'INACTIVE') {
        if (target.subscription && target.subscription.status !== 'INACTIVE') {
          await prisma.subscription.update({
            where: { userId: target.id },
            data: { status: 'INACTIVE', cancelAtPeriodEnd: false },
          })
          await prisma.adminAuditLog.create({
            data: {
              actorId,
              action: 'user.subscription.update',
              target: target.email,
              ipAddress,
              metadata: { from: target.subscription.status, to: nextStatus },
            },
          })
          changes.push('subscription')
        }
      } else {
        const planId = parsed.data.planId ?? target.subscription?.planId
        if (!planId) {
          return apiError('Choose a plan before activating a subscription.', 400)
        }

        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
        if (!plan) {
          return apiError(
            `Plan "${planId}" is not configured. Run the seed script or configure billing first.`,
            400,
          )
        }

        const currentPlanId = target.subscription?.planId ?? null
        const changed =
          target.subscription?.status !== nextStatus || currentPlanId !== plan.id

        if (changed) {
          const window = subscriptionWindow(plan.interval)
          await prisma.subscription.upsert({
            where: { userId: target.id },
            update: {
              planId: plan.id,
              status: nextStatus,
              currentPeriodStart: window.start,
              currentPeriodEnd: window.end,
              cancelAtPeriodEnd: nextStatus === 'CANCELED',
            },
            create: {
              userId: target.id,
              planId: plan.id,
              status: nextStatus,
              currentPeriodStart: window.start,
              currentPeriodEnd: window.end,
              cancelAtPeriodEnd: nextStatus === 'CANCELED',
            },
          })
          await prisma.adminAuditLog.create({
            data: {
              actorId,
              action: 'user.subscription.update',
              target: target.email,
              ipAddress,
              metadata: {
                from: target.subscription?.status ?? 'NONE',
                to: nextStatus,
                planId: plan.id,
              },
            },
          })
          changes.push('subscription')
        }
      }
    }

    const updated = await prisma.user.findUnique({
      where: { id: target.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscription: { select: { status: true, planId: true } },
      },
    })

    return json({ data: updated, meta: { changed: changes } })
  } catch {
    return apiError('Could not update this user right now.', 503)
  }
}
