import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'

async function main() {
  const stamp = Date.now()
  const email = `smoke+${stamp}@predisha.local`
  const user = await prisma.user.create({
    data: { email, name: 'Smoke Test' },
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: `Smoke ${stamp}`,
      interval: 'MONTHLY',
      amountMinor: 0,
      currency: 'USD',
      features: {},
      active: false,
    },
  })
  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  writeFileSync(
    'prisma/_smoke.json',
    JSON.stringify({ email, token, planId: plan.id }, null, 2),
  )
  console.log(`created smoke user ${email} with ACTIVE subscription`)
}

main()
  .catch(error => {
    console.error('smoke create failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
