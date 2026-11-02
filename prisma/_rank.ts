import { rankPredictions } from '@/lib/predictions/engine'
import { buildMatchAnalyses } from '@/lib/sports/service'
import { toMatchView } from '@/lib/sports/view-model'
import { prisma } from '@/lib/prisma'
import type { SportsDataset } from '@/lib/sports/service'
import type { FixtureStatus } from '@/lib/sports/provider'

const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  const now = new Date()
  const [dbSports, dbCompetitions, dbTeams, dbFixtures] = await Promise.all([
    prisma.sport.findMany({ where: { active: true } }),
    prisma.competition.findMany({ where: { active: true } }),
    prisma.team.findMany(),
    prisma.fixture.findMany({
      where: {
        kickoffUtc: {
          gte: new Date(now.getTime() - 120 * DAY_MS),
          lte: new Date(now.getTime() + 30 * DAY_MS),
        },
      },
      include: { competition: true },
      orderBy: { kickoffUtc: 'asc' },
    }),
  ])

  const competitionsById = new Map(dbCompetitions.map(c => [c.id, c]))
  const dataset: SportsDataset = {
    sportList: dbSports.map(s => ({ id: s.id, name: s.name, slug: s.slug })),
    competitions: dbCompetitions.map(c => ({
      id: c.id,
      name: c.name,
      country: c.country ?? null,
      season: c.season ?? null,
      sportId: c.sportId,
      providerId: c.providerId ?? null,
    })),
    teams: dbTeams.map(t => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logoUrl: t.logoUrl ?? null,
      providerId: t.providerId ?? null,
    })),
    fixtures: dbFixtures.map(f => ({
      id: f.id,
      providerId: f.providerId ?? null,
      competitionId: f.competitionId,
      sportId: competitionsById.get(f.competitionId)?.sportId ?? 'football',
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoffUtc: f.kickoffUtc,
      status: f.status as FixtureStatus,
      homeScore: f.homeScore ?? null,
      awayScore: f.awayScore ?? null,
      lastSyncedAt: f.lastSyncedAt ?? null,
    })),
    health: { ok: true, mode: 'live', message: 'direct db' },
    isDemo: false,
  }

  console.log(`fixtures=${dataset.fixtures.length}, teams=${dataset.teams.length}`)
  const analyses = buildMatchAnalyses(dataset, now)
  console.log(`analyses=${analyses.length}`)
  const views = analyses.map(item => toMatchView(item))
  const eligible = views.filter(
    view =>
      view.status === 'SCHEDULED' &&
      view.probability !== null &&
      view.topOutcome !== null,
  )
  console.log(`eligible=${eligible.length}`)
  const ranked = rankPredictions(
    eligible.map(view => ({
      match: view,
      probability: view.topOutcome!.probability,
      modelVersion: view.modelVersion ?? 'unknown',
      qualityFlags: view.qualityFlags,
    })),
  )
  console.log(`ranked=${ranked.length}`)
  const upcoming = eligible.filter(view => new Date(view.kickoffIso).getTime() > now.getTime())
  console.log(`eligibleUpcoming=${upcoming.length}`)
  for (const view of upcoming.slice(0, 10)) {
    console.log(
      `${view.kickoffLabel} | ${view.home.name} vs ${view.away.name} | p=${view.topOutcome?.probability.toFixed(3)} | flags=${view.qualityFlags.join(',') || 'none'}`,
    )
  }
}

main()
  .catch(error => {
    console.error('rank failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
