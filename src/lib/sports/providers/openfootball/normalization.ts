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

export function normalizeFixture(raw: any, parserVersion: string): NormalizedFixture {
  return {
    providerId: raw.providerId ?? null,
    competitionId: raw.competitionId ?? 'unknown',
    homeTeamId: raw.homeTeamId ?? 'unknown',
    awayTeamId: raw.awayTeamId ?? 'unknown',
    kickoffUtc: new Date(raw.kickoffUtc ?? Date.now()),
    status: raw.status ?? 'SCHEDULED',
    homeScore: raw.homeScore ?? null,
    awayScore: raw.awayScore ?? null,
    sourceProvider: raw.sourceProvider ?? 'openfootball',
    sourceRecordId: raw.sourceRecordId ?? null,
    sourceFilePath: raw.sourceFilePath ?? null,
    sourceRevision: raw.sourceRevision ?? null,
    retrievedAt: raw.retrievedAt ? new Date(raw.retrievedAt) : undefined,
    sourceUpdatedAt: raw.sourceUpdatedAt ? new Date(raw.sourceUpdatedAt) : undefined,
    importedAt: new Date(),
    parserVersion,
    dataQualityStatus: 'PENDING',
    isEligibleForTraining: false,
  }
}
