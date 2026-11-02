import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'

async function main() {
  const smoke = JSON.parse(readFileSync('prisma/_smoke.json', 'utf8')) as {
    token: string
  }
  const session = await prisma.session.findUnique({
    where: { sessionToken: smoke.token },
    include: { user: { include: { subscription: true } } },
  })
  if (!session) {
    console.log('session NOT found')
    return
  }
  console.log(
    `session found for ${session.user.email}; expires=${session.expires.toISOString()}; subscription=${session.user.subscription?.status ?? 'none'}`,
  )
}

main()
  .catch(error => {
    console.error('smoke check failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
