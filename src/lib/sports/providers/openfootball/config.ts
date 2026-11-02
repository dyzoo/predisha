// OpenFootball adapter skeleton — disabled by default until exact dataset
// licence (football.json / world / repo-specific) is verified and commercial
// use is confirmed. See docs/OPENFOOTBALL_LICENSE.md before enabling.

export const OPENFOOTBALL_ENABLED = false
export const OPENFOOTBALL_LICENSE_CHECKED = false

export interface OpenFootballImportConfig {
  enabled: boolean
  licenseChecked: boolean
  allowedRepos: string[]
  parserVersion: string
}

export function getOpenFootballConfig(): OpenFootballImportConfig {
  return {
    enabled: OPENFOOTBALL_ENABLED,
    licenseChecked: OPENFOOTBALL_LICENSE_CHECKED,
    allowedRepos: ['openfootball/football.json'],
    parserVersion: '0.1.0',
  }
}
