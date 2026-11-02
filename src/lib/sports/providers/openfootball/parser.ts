export interface ParsedOpenFootballFixture {
  sourceProvider: 'openfootball'
  providerId?: string
  competitionName: string
  homeName: string
  awayName: string
  kickoffUtc: Date
  status: string
  homeScore?: number
  awayScore?: number
  sourceFilePath: string
  sourceRevision: string
  retrievedAt: Date
}

export function parseOpenFootballFile(path: string, content: string): ParsedOpenFootballFixture[] {
  // Placeholder: requires exact JSON schema validation before activation.
  // Do not import without verified licence and commercial-use confirmation.
  return []
}
