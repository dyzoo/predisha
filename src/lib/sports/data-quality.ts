export interface DataQualityStatus {
  status: 'GOOD' | 'PENDING' | 'STALE' | 'CONFLICT' | 'REJECTED'
  flags: string[]
  message: string
}

export interface SourceProvenance {
  sourceProvider: string
  sourceRecordId?: string | null
  sourceFilePath?: string | null
  sourceRevision?: string | null
  retrievedAt?: Date | null
  sourceUpdatedAt?: Date | null
  importedAt?: Date | null
  parserVersion?: string | null
  isEligibleForTraining: boolean
}

export function evaluateFixtureQuality(
  fixture: { lastSyncedAt?: Date | null; kickoffUtc: Date; status: string; sourceProvider?: string | null },
  now: Date = new Date(),
): DataQualityStatus {
  const flags: string[] = []
  if (!fixture.sourceProvider || fixture.sourceProvider === 'unknown') flags.push('MISSING_SOURCE')
  if (!fixture.lastSyncedAt) flags.push('STALE_INPUT')
  else {
    const ageHours = (now.getTime() - new Date(fixture.lastSyncedAt).getTime()) / (60 * 60 * 1000)
    if (ageHours > 24 * 21) flags.push('STALE_INPUT')
  }
  if (fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED' || fixture.status === 'ABANDONED') {
    flags.push('INELIGIBLE_STATUS')
  }
  const hasConflict = flags.includes('STALE_INPUT') && flags.includes('MISSING_SOURCE')
  return {
    status: flags.length === 0 ? 'GOOD' : flags.includes('INELIGIBLE_STATUS') || hasConflict ? 'REJECTED' : flags.includes('STALE_INPUT') ? 'STALE' : 'PENDING',
    flags,
    message: flags.length === 0 ? 'Data quality acceptable.' : `Quality issues: ${flags.join(', ')}.`,
  }
}
