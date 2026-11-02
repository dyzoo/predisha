import { getOpenFootballConfig } from './config'
import { parseOpenFootballFile } from './parser'
import { normalizeFixture } from './normalization'

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  rejected: number
  conflicts: number
  parserVersion: string
}

export async function importOpenFootballFile(
  filePath: string,
  content: string,
): Promise<ImportResult> {
  const cfg = getOpenFootballConfig()
  if (!cfg.enabled || !cfg.licenseChecked) {
    throw new Error('OpenFootball adapter disabled: enable only after licence verification.')
  }
  const parsed = parseOpenFootballFile(filePath, content)
  const normalized = parsed.map(p => normalizeFixture(p, cfg.parserVersion))
  // Deduplication and conflict checks must be added before production activation.
  return {
    inserted: normalized.length,
    updated: 0,
    skipped: 0,
    rejected: 0,
    conflicts: 0,
    parserVersion: cfg.parserVersion,
  }
}
