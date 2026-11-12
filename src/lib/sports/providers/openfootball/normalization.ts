export interface NormalizedFixture {
  providerId?: string
  competitionId: string
  homeTeamId: string
  awayTeamId: string
  kickoffUtc: Date
  status: string
  homeScore?: number
  awayScore?: number
  sourceProvider: string
  sourceRecordId?: string
  sourceFilePath?: string
  sourceRevision?: string
  retrievedAt?: Date
  sourceUpdatedAt?: Date
  importedAt?: Date
  parserVersion?: string
  dataQualityStatus?: string
  isEligibleForTraining?: boolean
}

interface RawOpenFootballFixture {
  providerId?: string
  competitionId?: string
  homeTeamId?: string
  awayTeamId?: string
  kickoffUtc?: string | number | Date
  status?: string
  homeScore?: number
  awayScore?: number
  sourceProvider?: string
  sourceRecordId?: string
  sourceFilePath?: string
  sourceRevision?: string
  retrievedAt?: string | number | Date
  sourceUpdatedAt?: string | number | Date
}

export function normalizeFixture(
  raw: RawOpenFootballFixture,
  parserVersion: string,
): NormalizedFixture {
  return {
    providerId: raw.providerId ?? undefined,
    competitionId: raw.competitionId ?? 'unknown',
    homeTeamId: raw.homeTeamId ?? 'unknown',
    awayTeamId: raw.awayTeamId ?? 'unknown',
    kickoffUtc:
      raw.kickoffUtc instanceof Date
        ? raw.kickoffUtc
        : new Date(raw.kickoffUtc ?? Date.now()),
    status: raw.status ?? 'SCHEDULED',
    homeScore: raw.homeScore ?? undefined,
    awayScore: raw.awayScore ?? undefined,
    sourceProvider: raw.sourceProvider ?? 'openfootball',
    sourceRecordId: raw.sourceRecordId ?? undefined,
    sourceFilePath: raw.sourceFilePath ?? undefined,
    sourceRevision: raw.sourceRevision ?? undefined,
    retrievedAt: raw.retrievedAt ? new Date(raw.retrievedAt) : undefined,
    sourceUpdatedAt: raw.sourceUpdatedAt ? new Date(raw.sourceUpdatedAt) : undefined,
    importedAt: new Date(),
    parserVersion,
    dataQualityStatus: 'PENDING',
    isEligibleForTraining: false,
  }
}
