import type { FixtureStatus, PrismaClient } from '@prisma/client'
import type { MatchAnalysis } from './service'
import { prisma } from '@/lib/prisma'

type Db = Pick<
  PrismaClient,
  'sport' | 'competition' | 'team' | 'fixture' | '$transaction'
>

/**
 * Ensures the provider fixture exists in our database so that saved fixtures,
 * predictions and evaluations can reference it. Provider ids are reused as
 * primary keys, keeping the operation idempotent.
 */
export async function ensureFixturePersisted(analysis: MatchAnalysis, db: Db = prisma): Promise<void> {
  const { fixture, competition, sport, home, away } = analysis

  await db.$transaction([
    db.sport.upsert({
      where: { id: sport.id },
      update: { name: sport.name, slug: sport.slug, active: true },
      create: { id: sport.id, name: sport.name, slug: sport.slug, active: true },
    }),
    db.competition.upsert({
      where: { id: competition.id },
      update: {
        name: competition.name,
        country: competition.country ?? null,
        season: competition.season ?? null,
        sportId: sport.id,
        active: true,
      },
      create: {
        id: competition.id,
        providerId: competition.providerId ?? competition.id,
        name: competition.name,
        country: competition.country ?? null,
        season: competition.season ?? null,
        sportId: sport.id,
        active: true,
      },
    }),
    db.team.upsert({
      where: { id: home.id },
      update: {
        name: home.name,
        shortName: home.shortName,
        color: home.color,
        logoUrl: home.logoUrl ?? null,
      },
      create: {
        id: home.id,
        providerId: home.providerId ?? home.id,
        name: home.name,
        shortName: home.shortName,
        color: home.color,
        logoUrl: home.logoUrl ?? null,
      },
    }),
    db.team.upsert({
      where: { id: away.id },
      update: {
        name: away.name,
        shortName: away.shortName,
        color: away.color,
        logoUrl: away.logoUrl ?? null,
      },
      create: {
        id: away.id,
        providerId: away.providerId ?? away.id,
        name: away.name,
        shortName: away.shortName,
        color: away.color,
        logoUrl: away.logoUrl ?? null,
      },
    }),
    db.fixture.upsert({
      where: { id: fixture.id },
      update: {
        kickoffUtc: fixture.kickoffUtc,
        status: fixture.status as FixtureStatus,
        homeScore: fixture.homeScore ?? null,
        awayScore: fixture.awayScore ?? null,
        lastSyncedAt: new Date(),
      },
      create: {
        id: fixture.id,
        providerId: fixture.providerId ?? fixture.id,
        competitionId: competition.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        kickoffUtc: fixture.kickoffUtc,
        status: fixture.status as FixtureStatus,
        homeScore: fixture.homeScore ?? null,
        awayScore: fixture.awayScore ?? null,
      },
    }),
  ])
}
