import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function required(name, value) {
  if (!value) return null
  return value
}

function demoSeedingEnabled() {
  const flag = process.env.SEED_DEMO_USERS
  if (flag === 'true') return true
  if (flag === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

function demoPassword() {
  const password = process.env.SEED_USER_PASSWORD ?? 'PredishaTest123!'
  if (password.length < 12) {
    throw new Error('SEED_USER_PASSWORD must be at least 12 characters.')
  }
  return password
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped admin account.')
    return
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', passwordHash, emailVerified: new Date() },
    create: {
      email,
      role: 'ADMIN',
      passwordHash,
      name: 'Administrator',
      emailVerified: new Date(),
    },
  })
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })
  console.log(`[seed] admin ready: ${user.email}`)
}

async function seedPlans() {
  const currency = (process.env.BILLING_CURRENCY ?? 'USD').toUpperCase()
  const planConfigs = [
    {
      id: 'weekly',
      name: 'Weekly Premium',
      interval: 'WEEKLY',
      amount: required('BILLING_WEEKLY_AMOUNT_MINOR', process.env.BILLING_WEEKLY_AMOUNT_MINOR),
      priceId: process.env.BILLING_WEEKLY_PRICE_ID,
      features: ['Full prediction board', 'Match explanations and input snapshots', 'Saved matches and preferences'],
    },
    {
      id: 'monthly',
      name: 'Monthly Premium',
      interval: 'MONTHLY',
      amount: required('BILLING_MONTHLY_AMOUNT_MINOR', process.env.BILLING_MONTHLY_AMOUNT_MINOR),
      priceId: process.env.BILLING_MONTHLY_PRICE_ID,
      features: ['Everything in Weekly', 'Historical performance and evaluation detail', 'Priority access to validated markets'],
    },
  ]

  for (const plan of planConfigs) {
    if (!plan.amount) {
      console.warn(`[seed] no amount configured for ${plan.id}; skipped plan.`)
      continue
    }
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        interval: plan.interval,
        amountMinor: Number.parseInt(plan.amount, 10),
        currency,
        features: plan.features,
        providerPriceId: plan.priceId ?? null,
        active: true,
      },
      create: {
        id: plan.id,
        name: plan.name,
        interval: plan.interval,
        amountMinor: Number.parseInt(plan.amount, 10),
        currency,
        features: plan.features,
        providerPriceId: plan.priceId ?? null,
        active: true,
      },
    })
    console.log(`[seed] plan ready: ${plan.id}`)
  }
}

const DEMO_PLANS = {
  weekly: {
    id: 'weekly',
    name: 'Weekly Premium',
    interval: 'WEEKLY',
    amountMinor: 499,
    features: ['Full prediction board', 'Match explanations and input snapshots', 'Saved matches and preferences'],
  },
  monthly: {
    id: 'monthly',
    name: 'Monthly Premium',
    interval: 'MONTHLY',
    amountMinor: 1499,
    features: ['Everything in Weekly', 'Historical performance and evaluation detail', 'Priority access to validated markets'],
  },
}

const DEMO_USERS = [
  {
    key: 'admin',
    email: 'admin@predisha.test',
    name: 'Ada Admin',
    role: 'ADMIN',
    timezone: 'UTC',
    locale: 'en',
  },
  {
    key: 'premium',
    email: 'premium@predisha.test',
    name: 'Priya Premium',
    role: 'USER',
    plan: 'monthly',
    status: 'ACTIVE',
    timezone: 'Africa/Nairobi',
    locale: 'en',
  },
  {
    key: 'trial',
    email: 'trial@predisha.test',
    name: 'Tariq Trial',
    role: 'USER',
    plan: 'weekly',
    status: 'TRIALING',
    timezone: 'Europe/London',
    locale: 'en',
  },
  {
    key: 'free',
    email: 'free@predisha.test',
    name: 'Farah Free',
    role: 'USER',
    timezone: 'UTC',
    locale: 'en',
  },
  {
    key: 'preview',
    email: 'preview@predisha.test',
    name: 'Pendo Preview',
    role: 'USER',
    timezone: 'Africa/Dar_es_Salaam',
    locale: 'sw',
    usedFreePreview: true,
  },
  {
    key: 'pastdue',
    email: 'pastdue@predisha.test',
    name: 'Paul Pastdue',
    role: 'USER',
    plan: 'monthly',
    status: 'PAST_DUE',
    timezone: 'America/New_York',
    locale: 'en',
  },
  {
    key: 'canceled',
    email: 'canceled@predisha.test',
    name: 'Cara Canceled',
    role: 'USER',
    plan: 'monthly',
    status: 'CANCELED',
    cancelAtPeriodEnd: true,
    timezone: 'America/Chicago',
    locale: 'en',
  },
  {
    key: 'unpaid',
    email: 'unpaid@predisha.test',
    name: 'Uma Unpaid',
    role: 'USER',
    plan: 'weekly',
    status: 'UNPAID',
    timezone: 'Europe/Berlin',
    locale: 'en',
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

async function ensureDemoPlans() {
  const currency = (process.env.BILLING_CURRENCY ?? 'USD').toUpperCase()
  const plans = {}

  for (const plan of Object.values(DEMO_PLANS)) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: plan.id } })
    plans[plan.id] =
      existing ??
      (await prisma.subscriptionPlan.create({
        data: {
          id: plan.id,
          name: plan.name,
          interval: plan.interval,
          amountMinor: plan.amountMinor,
          currency,
          features: plan.features,
          active: true,
        },
      }))
  }

  return plans
}

function subscriptionWindow(interval, status) {
  const now = Date.now()
  const length = interval === 'WEEKLY' ? 7 * DAY_MS : 30 * DAY_MS

  if (status === 'PAST_DUE') {
    return { start: new Date(now - length), end: new Date(now - 3 * DAY_MS) }
  }
  if (status === 'UNPAID') {
    return { start: new Date(now - length), end: new Date(now - DAY_MS) }
  }

  return { start: new Date(now), end: new Date(now + length) }
}

async function seedDemoUsers() {
  if (!demoSeedingEnabled()) {
    console.warn('[seed] demo users disabled (set SEED_DEMO_USERS=true to enable outside development).')
    return
  }

  const password = demoPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const plans = await ensureDemoPlans()
  const users = {}

  for (const entry of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        role: entry.role,
        passwordHash,
        emailVerified: new Date(),
      },
      create: {
        email: entry.email,
        name: entry.name,
        role: entry.role,
        passwordHash,
        emailVerified: new Date(),
      },
    })
    users[entry.key] = user

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: { timezone: entry.timezone, locale: entry.locale },
      create: { userId: user.id, timezone: entry.timezone, locale: entry.locale },
    })

    if (entry.plan && entry.status) {
      const plan = plans[entry.plan]
      const window = subscriptionWindow(plan.interval, entry.status)
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          planId: plan.id,
          status: entry.status,
          currentPeriodStart: window.start,
          currentPeriodEnd: window.end,
          cancelAtPeriodEnd: Boolean(entry.cancelAtPeriodEnd),
        },
        create: {
          userId: user.id,
          planId: plan.id,
          status: entry.status,
          currentPeriodStart: window.start,
          currentPeriodEnd: window.end,
          cancelAtPeriodEnd: Boolean(entry.cancelAtPeriodEnd),
        },
      })
    } else {
      await prisma.subscription.deleteMany({ where: { userId: user.id } })
    }

    if (entry.usedFreePreview) {
      const slip = await prisma.predictionSlip.upsert({
        where: { id: 'seed-free-preview-slip' },
        update: { userId: user.id },
        create: {
          id: 'seed-free-preview-slip',
          userId: user.id,
          stake: 10,
          currency: 'USD',
          risk: 'balanced',
          impliedCombinedOdds: 2.1,
          combinedProbability: 0.476,
          potentialReturn: 21,
          netProfit: 11,
          modelVersion: 'seed-demo',
          dataAsOf: new Date(),
          demo: true,
          limited: true,
          status: 'PENDING',
        },
      })
      await prisma.predictionSlipSelection.deleteMany({ where: { slipId: slip.id } })
      await prisma.predictionSlipSelection.create({
        data: {
          slipId: slip.id,
          fixtureId: 'seed-fixture-1',
          competition: 'Seed Demo League',
          homeName: 'Demo Home',
          awayName: 'Demo Away',
          kickoffUtc: new Date(Date.now() + DAY_MS),
          outcomeKey: 'HOME',
          probability: 0.476,
          impliedOdds: 2.1,
          homeProbability: 0.476,
          drawProbability: 0.27,
          awayProbability: 0.254,
        },
      })
      await prisma.userFreePreview.upsert({
        where: { userId: user.id },
        update: { slipId: slip.id },
        create: { userId: user.id, slipId: slip.id },
      })
    }

    console.log(`[seed] demo user ready: ${entry.email} (${entry.role}${entry.status ? `, ${entry.status}` : ''})`)
  }

  const fixtures = await prisma.fixture
    .findMany({ orderBy: { kickoffUtc: 'asc' }, take: 3, select: { id: true } })
    .catch(() => [])
  if (fixtures.length > 0 && users.premium) {
    for (const fixture of fixtures) {
      await prisma.savedFixture.upsert({
        where: { userId_fixtureId: { userId: users.premium.id, fixtureId: fixture.id } },
        update: {},
        create: { userId: users.premium.id, fixtureId: fixture.id },
      })
    }
    console.log(`[seed] saved ${fixtures.length} fixtures for ${users.premium.email}`)
  }

  console.log(`[seed] demo login password: ${password}`)
}

try {
  await seedAdmin()
  await seedPlans()
  await seedDemoUsers()
} finally {
  await prisma.$disconnect()
}
