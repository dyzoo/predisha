import type { PrismaClient } from '@prisma/client'
import type { Fixture, Team } from '@/lib/sports/provider'
import { FootballDataProvider } from './football-data'
import { prisma } from '@/lib/prisma'

type Db = PrismaClient

export interface SyncResult {
  competitions: number
  teams: number
  fixtures: number
  errors: string[]
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
      competitions = await this.syncCompetitions()
      teams = await this.syncTeams()
      fixtures = await this.syncFixtures()

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

  private async syncCompetitions(): Promise<number> {
    const providerCompetitions = await this.provider.getCompetitions()
    let count = 0
    for (const comp of providerCompetitions) {
      const sport = await this.db.sport.upsert({
        where: { id: 'football' },
        update: { name: 'Football', slug: 'football', active: true },
        create: { id: 'football', name: 'Football', slug: 'football', active: true },
      })
      await this.db.competition.upsert({
        where: { id: comp.id },
        update: {
          name: comp.name,
          country: comp.country ?? null,
          season: comp.season ?? null,
          sportId: sport.id,
          active: true,
        },
        create: {
          id: comp.id,
          providerId: comp.providerId ?? comp.id,
          name: comp.name,
          country: comp.country ?? null,
          season: comp.season ?? null,
          sportId: sport.id,
          active: true,
        },
      })
      count += 1
    }
    return count
  }

  private async syncTeams(): Promise<number> {
    const providerTeams = await this.provider.getTeams()
    let count = 0
    for (const team of providerTeams) {
      await this.db.team.upsert({
        where: { id: team.id },
        update: {
          name: team.name,
          shortName: team.shortName,
          color: team.color,
          logoUrl: team.logoUrl ?? null,
        },
        create: {
          id: team.id,
          providerId: team.providerId ?? team.id,
          name: team.name,
          shortName: team.shortName,
          color: team.color,
          logoUrl: team.logoUrl ?? null,
        },
      })
      count += 1
    }
    return count
  }

  private async syncFixtures(): Promise<number> {
    const now = new Date()
    // Keep enough finished history for the model's minimum sample gate. The
    // provider only accepts 10-day windows, so this becomes 6 chunked calls.
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const providerFixtures = await this.provider.getFixtures(from, to)
    let count = 0
    for (const fx of providerFixtures) {
      await this.upsertFixture(fx)
      count += 1
    }
    return count
  }

  private teamFields(teamId: string, team?: Team) {
    if (team) {
      return {
        providerId: team.providerId ?? teamId,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        logoUrl: team.logoUrl ?? null,
      }
    }
    return {
      providerId: teamId,
      name: `Team ${teamId}`,
      shortName: teamId.slice(-3).toUpperCase(),
      color: '#9CA3AF',
      logoUrl: null,
    }
  }

  private async upsertFixture(fixture: Fixture): Promise<void> {
    await this.db.$transaction([
      this.db.team.upsert({
        where: { id: fixture.homeTeamId },
        update: this.teamFields(fixture.homeTeamId, fixture.homeTeam),
        create: { id: fixture.homeTeamId, ...this.teamFields(fixture.homeTeamId, fixture.homeTeam) },
      }),
      this.db.team.upsert({
        where: { id: fixture.awayTeamId },
        update: this.teamFields(fixture.awayTeamId, fixture.awayTeam),
        create: { id: fixture.awayTeamId, ...this.teamFields(fixture.awayTeamId, fixture.awayTeam) },
      }),
      this.db.competition.upsert({
        where: { id: fixture.competitionId },
        update: {},
        create: {
          id: fixture.competitionId,
          providerId: fixture.competitionId,
          name: `Competition ${fixture.competitionId}`,
          sportId: 'football',
          active: true,
        },
      }),
      this.db.sport.upsert({
        where: { id: 'football' },
        update: {},
        create: { id: 'football', name: 'Football', slug: 'football', active: true },
      }),
      this.db.fixture.upsert({
        where: { id: fixture.id },
        update: {
          kickoffUtc: fixture.kickoffUtc,
          status: fixture.status,
          homeScore: fixture.homeScore ?? null,
          awayScore: fixture.awayScore ?? null,
          lastSyncedAt: new Date(),
        },
        create: {
          id: fixture.id,
          providerId: fixture.providerId ?? fixture.id,
          competitionId: fixture.competitionId,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          kickoffUtc: fixture.kickoffUtc,
          status: fixture.status,
          homeScore: fixture.homeScore ?? null,
          awayScore: fixture.awayScore ?? null,
          lastSyncedAt: new Date(),
        },
      }),
    ])
  }
}

export async function syncFootballData(): Promise<SyncResult> {
  const provider = new FootballDataProvider()
  const syncer = new SportsDataSyncer(provider)
  return syncer.sync()
}
