import type { PrismaClient } from '@prisma/client'
import type { Competition, Fixture, Team } from '@/lib/sports/provider'
import { FootballDataProvider } from './football-data'
import { prisma } from '@/lib/prisma'

type Db = PrismaClient

export interface SyncResult {
  competitions: number
  teams: number
  fixtures: number
  errors: string[]
}

const BATCH_SIZE = 200

function fixtureRows(fixtures: Fixture[]) {
  return fixtures.map(fixture => ({
    id: fixture.id,
    providerId: fixture.providerId ?? fixture.id,
    competitionId: fixture.competitionId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    kickoffUtc: fixture.kickoffUtc.toISOString(),
    status: fixture.status,
    homeScore: fixture.homeScore ?? null,
    awayScore: fixture.awayScore ?? null,
    liveMinute: fixture.liveMinute ?? null,
    liveHomeScore: fixture.liveHomeScore ?? null,
    liveAwayScore: fixture.liveAwayScore ?? null,
    halfTimeHomeScore: fixture.halfTimeHomeScore ?? null,
    halfTimeAwayScore: fixture.halfTimeAwayScore ?? null,
    venue: fixture.venue ?? null,
    referee: fixture.referee ?? null,
  }))
}

export class SportsDataSyncer {
  private provider: FootballDataProvider
  private db: Db
  private errors: string[] = []

  constructor(provider: FootballDataProvider, db: Db = prisma) {
    this.provider = provider
    this.db = db
  }

  async sync(): Promise<SyncResult> {
    const job = await this.db.syncJob.create({
      data: { type: 'football-data', status: 'RUNNING' },
    })

    let competitions = 0
    let teams = 0
    let fixtures = 0

    try {
      const now = new Date()
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const historyFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

      const [allFixtures, providerCompetitions] = await Promise.all([
        this.provider.getFixtures(historyFrom, to),
        this.provider.getCompetitions(),
      ])

      await this.ensureSport()
      competitions = await this.upsertCompetitions(providerCompetitions)
      teams = await this.upsertTeams(allFixtures)
      fixtures = await this.upsertFixtures(allFixtures, from)

      await this.db.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          metadata: { competitions, teams, fixtures },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.errors.push(message)
      await this.db.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: message,
        },
      })
      throw error
    }

    return { competitions, teams, fixtures, errors: this.errors }
  }

  async refreshFixtures(fixtureIds: string[]): Promise<Fixture[]> {
    const results = await Promise.all(
      fixtureIds.map(async fixtureId => {
        const fixture = await this.provider.getFixture(fixtureId)
        if (!fixture) return null
        await this.upsertFixtures([fixture], new Date(0))
        return fixture
      }),
    )
    return results.filter((fixture): fixture is Fixture => fixture !== null)
  }

  private async ensureSport(): Promise<void> {
    await this.db.sport.upsert({
      where: { id: 'football' },
      update: { name: 'Football', slug: 'football', active: true },
      create: { id: 'football', name: 'Football', slug: 'football', active: true },
    })
  }

  private async upsertCompetitions(competitions: Competition[]): Promise<number> {
    if (competitions.length === 0) return 0
    for (let index = 0; index < competitions.length; index += BATCH_SIZE) {
      const rows = competitions.slice(index, index + BATCH_SIZE).map(item => ({
        id: item.id,
        providerId: item.providerId ?? item.id,
        name: item.name,
        country: item.country ?? null,
        season: item.season ?? null,
        sportId: item.sportId || 'football',
        active: true,
      }))
      await this.db.$executeRaw`
        INSERT INTO "Competition" ("id", "providerId", "name", "country", "season", "sportId", "active", "createdAt", "updatedAt")
        SELECT x."id", x."providerId", x."name", x."country", x."season", x."sportId", x."active", NOW(), NOW()
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(
          "id" text, "providerId" text, "name" text, "country" text, "season" text, "sportId" text, "active" bool
        )
        ON CONFLICT ("id") DO UPDATE SET
          "providerId" = EXCLUDED."providerId",
          "name" = EXCLUDED."name",
          "country" = EXCLUDED."country",
          "season" = EXCLUDED."season",
          "sportId" = EXCLUDED."sportId",
          "active" = EXCLUDED."active",
          "updatedAt" = NOW()
      `
    }
    return competitions.length
  }

  private async upsertTeams(fixtures: Fixture[]): Promise<number> {
    const teamsById = new Map<string, Team>()
    for (const fixture of fixtures) {
      for (const team of [fixture.homeTeam, fixture.awayTeam]) {
        if (team && !teamsById.has(team.id)) teamsById.set(team.id, team)
      }
    }
    const teams = [...teamsById.values()]
    for (let index = 0; index < teams.length; index += BATCH_SIZE) {
      const rows = teams.slice(index, index + BATCH_SIZE).map(team => ({
        id: team.id,
        providerId: team.providerId ?? team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        logoUrl: team.logoUrl ?? null,
      }))
      await this.db.$executeRaw`
        INSERT INTO "Team" ("id", "providerId", "name", "shortName", "color", "logoUrl", "createdAt", "updatedAt")
        SELECT x."id", x."providerId", x."name", x."shortName", x."color", x."logoUrl", NOW(), NOW()
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(
          "id" text, "providerId" text, "name" text, "shortName" text, "color" text, "logoUrl" text
        )
        ON CONFLICT ("id") DO UPDATE SET
          "providerId" = EXCLUDED."providerId",
          "name" = EXCLUDED."name",
          "shortName" = EXCLUDED."shortName",
          "color" = EXCLUDED."color",
          "logoUrl" = EXCLUDED."logoUrl",
          "updatedAt" = NOW()
      `
    }
    return teams.length
  }

  private async upsertFixtures(fixtures: Fixture[], activeFrom: Date): Promise<number> {
    const active: Fixture[] = []
    const history: Fixture[] = []
    for (const fixture of fixtures) {
      if (fixture.kickoffUtc.getTime() < activeFrom.getTime()) {
        const usableHistory =
          fixture.status === 'FINISHED' &&
          typeof fixture.homeScore === 'number' &&
          typeof fixture.awayScore === 'number'
        if (!usableHistory) continue
        history.push(fixture)
      } else {
        active.push(fixture)
      }
    }

    for (const group of [active, history]) {
      for (let index = 0; index < group.length; index += BATCH_SIZE) {
        await this.upsertFixtureBatch(fixtureRows(group.slice(index, index + BATCH_SIZE)))
      }
    }
    return active.length + history.length
  }

  private async upsertFixtureBatch(
    rows: ReturnType<typeof fixtureRows>,
  ): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "Fixture" (
        "id", "providerId", "competitionId", "homeTeamId", "awayTeamId", "kickoffUtc",
        "status", "homeScore", "awayScore", "liveMinute", "liveHomeScore", "liveAwayScore",
        "halfTimeHomeScore", "halfTimeAwayScore", "venue", "referee", "lastSyncedAt",
        "sourceProvider", "createdAt", "updatedAt"
      )
      SELECT x."id", x."providerId", x."competitionId", x."homeTeamId", x."awayTeamId",
        x."kickoffUtc"::timestamptz, x."status"::"FixtureStatus", x."homeScore", x."awayScore",
        x."liveMinute", x."liveHomeScore", x."liveAwayScore", x."halfTimeHomeScore",
        x."halfTimeAwayScore", x."venue", x."referee", NOW(), 'football-data', NOW(), NOW()
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(
        "id" text, "providerId" text, "competitionId" text, "homeTeamId" text, "awayTeamId" text,
        "kickoffUtc" text, "status" text, "homeScore" int, "awayScore" int, "liveMinute" int,
        "liveHomeScore" int, "liveAwayScore" int, "halfTimeHomeScore" int, "halfTimeAwayScore" int,
        "venue" text, "referee" text
      )
      ON CONFLICT ("id") DO UPDATE SET
        "providerId" = EXCLUDED."providerId",
        "competitionId" = EXCLUDED."competitionId",
        "homeTeamId" = EXCLUDED."homeTeamId",
        "awayTeamId" = EXCLUDED."awayTeamId",
        "kickoffUtc" = EXCLUDED."kickoffUtc",
        "status" = EXCLUDED."status",
        "homeScore" = EXCLUDED."homeScore",
        "awayScore" = EXCLUDED."awayScore",
        "liveMinute" = EXCLUDED."liveMinute",
        "liveHomeScore" = EXCLUDED."liveHomeScore",
        "liveAwayScore" = EXCLUDED."liveAwayScore",
        "halfTimeHomeScore" = EXCLUDED."halfTimeHomeScore",
        "halfTimeAwayScore" = EXCLUDED."halfTimeAwayScore",
        "venue" = EXCLUDED."venue",
        "referee" = EXCLUDED."referee",
        "lastSyncedAt" = NOW(),
        "sourceProvider" = EXCLUDED."sourceProvider",
        "updatedAt" = NOW()
    `
  }
}

export async function refreshFootballDataFixtures(fixtureIds: string[]): Promise<Fixture[]> {
  if (fixtureIds.length === 0) return []
  const provider = new FootballDataProvider()
  return new SportsDataSyncer(provider).refreshFixtures(fixtureIds)
}

export async function syncFootballData(): Promise<SyncResult> {
  const provider = new FootballDataProvider()
  const syncer = new SportsDataSyncer(provider)
  return syncer.sync()
}
