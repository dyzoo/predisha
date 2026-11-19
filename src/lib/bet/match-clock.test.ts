import { describe, expect, it } from 'vitest'
import {
  formatMatchMinuteFromElapsed,
  matchClock,
  matchSegments,
} from './match-clock'
import type { TicketSimulationMeta } from './types'

const clock: TicketSimulationMeta = {
  liveStartedAt: '2026-01-01T12:00:00.000Z',
  durationMinutes: 90,
  seed: 'TEST12',
  kickoffIso: '2026-01-01T12:00:00.000Z',
}

function at(minutes: number): number {
  return Date.parse(clock.liveStartedAt) + minutes * 60_000
}

describe('matchSegments', () => {
  it('uses normal football phases for a 90 minute match', () => {
    expect(matchSegments(clock)).toMatchObject({
      half: 45,
      firstStoppage: 3,
      halfTime: 3,
      secondStoppage: 4,
      firstHalfEnd: 45,
      firstStoppageEnd: 48,
      halfTimeEnd: 51,
      secondHalfEnd: 96,
      fullTime: 100,
    })
  })
})

describe('matchClock', () => {
  it('counts from zero to 45 and shows first-half stoppage', () => {
    expect(matchClock(clock, at(0)).label).toBe("1'")
    expect(matchClock(clock, at(44)).label).toBe("45'")
    expect(matchClock(clock, at(45)).label).toBe("45+1'")
    expect(matchClock(clock, at(47)).label).toBe("45+3'")
  })

  it('shows half time then restarts the second half at 46', () => {
    expect(matchClock(clock, at(48)).label).toBe('HT')
    expect(matchClock(clock, at(50)).label).toBe('HT')
    expect(matchClock(clock, at(51)).label).toBe("46'")
    expect(matchClock(clock, at(95)).label).toBe("90'")
  })

  it('shows second-half stoppage and full time', () => {
    expect(matchClock(clock, at(96)).label).toBe("90+1'")
    expect(matchClock(clock, at(99)).label).toBe("90+4'")
    expect(matchClock(clock, at(100)).label).toBe('FT')
    expect(matchClock(clock, at(100)).live).toBe(false)
    expect(matchClock(clock, at(100)).finished).toBe(true)
  })

  it('keeps progress monotonic through the half-time break', () => {
    expect(matchClock(clock, at(47)).progress).toBeCloseTo(45 / 90)
    expect(matchClock(clock, at(48)).progress).toBeCloseTo(45 / 90)
    expect(matchClock(clock, at(51)).progress).toBeCloseTo(46 / 90)
  })

  it('formats a minute from elapsed time for catalog events', () => {
    expect(formatMatchMinuteFromElapsed(12)).toBe("13'")
    expect(formatMatchMinuteFromElapsed(46)).toBe("45+2'")
    expect(formatMatchMinuteFromElapsed(49)).toBe('HT')
    expect(formatMatchMinuteFromElapsed(60)).toBe("55'")
  })
})
