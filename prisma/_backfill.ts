import { syncFootballData } from '@/lib/sports/sync'
import { prisma } from '@/lib/prisma'

async function main() {
  const started = Date.now()
  const result = await syncFootballData()
  console.log(`sync finished in ${Math.round((Date.now() - started) / 1000)}s`)
  console.log(JSON.stringify(result))
  const fixtures = await prisma.fixture.count()
  const finished = await prisma.fixture.count({ where: { status: 'FINISHED' } })
  const scheduled = await prisma.fixture.count({
    where: { status: 'SCHEDULED', kickoffUtc: { gt: new Date() } },
  })
  console.log(`DB: fixtures=${fixtures}, finished=${finished}, scheduledUpcoming=${scheduled}`)
}

main()
  .catch(error => {
    console.error('backfill failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
