import { describe, it, expect } from 'vitest'
import { evaluateFixtureQuality } from './data-quality'

describe('Regression: prediction integrity and data quality', () => {
  it('rejects predictions with missing source', () => {
    const quality = evaluateFixtureQuality({ kickoffUtc: new Date(Date.now() + 86400000), status: 'SCHEDULED', sourceProvider: 'unknown' })
    expect(quality.flags).toContain('MISSING_SOURCE')
  })

  it('flags stale input when sync is older than 21 days', () => {
    const quality = evaluateFixtureQuality({ kickoffUtc: new Date(Date.now() + 86400000), status: 'SCHEDULED', sourceProvider: 'demo', lastSyncedAt: new Date(Date.now() - 30 * 86400000) })
    expect(quality.flags).toContain('STALE_INPUT')
  })
})
