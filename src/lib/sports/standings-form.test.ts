import { describe, expect, it } from 'vitest'
import { parseStandingForm } from './football-data'

describe('parseStandingForm', () => {
  it('keeps only valid W/D/L results in provider order', () => {
    expect(parseStandingForm('WWDLW')).toEqual(['W', 'W', 'D', 'L', 'W'])
  })

  it('ignores separators and unknown characters', () => {
    expect(parseStandingForm('W, D - L')).toEqual(['W', 'D', 'L'])
  })

  it('returns an empty array for missing values', () => {
    expect(parseStandingForm(null)).toEqual([])
    expect(parseStandingForm(undefined)).toEqual([])
    expect(parseStandingForm('')).toEqual([])
  })
})
