import { prisma } from '@/lib/prisma'

async function main() {
  const now = new Date()
  const [total, teams, competitions, byStatus, upcoming, range] = await Promise.all([
    prisma.fixture.count(),
    prisma.team.count(),
    prisma.competition.count(),
    prisma.fixture.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.fixture.count({ where: { kickoffUtc: { gt: now }, status: 'SCHEDULED' } }),
    prisma.fixture.aggregate({ _min: { kickoffUtc: true }, _max: { kickoffUtc: true } }),
  ])
  console.log(`fixtures=${total}, teams=${teams}, competitions=${competitions}`)
  console.log(`byStatus=${JSON.stringify(byStatus)}`)
  console.log(`scheduledUpcoming=${upcoming}`)
  console.log(
    `range=${range._min.kickoffUtc?.toISOString() ?? 'none'} .. ${range._max.kickoffUtc?.toISOString() ?? 'none'}`,
  )
  console.log(`now=${now.toISOString()}`)
}

main()
  .catch(error => {
    console.error('db counts failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
