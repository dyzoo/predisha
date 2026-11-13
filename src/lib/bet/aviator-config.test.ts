import { describe, expect, it } from 'vitest'
import { aviatorRoundAt, crashPointFor } from './aviator'
import { DEFAULT_AVIATOR_CONFIG, aviatorConfigFitsCycle, normalizeAviatorConfig } from './aviator-config'

describe('aviator crash point', () => {
  it('keeps crash points between one and the configured ceiling', () => {
    const first = crashPointFor('av-1', DEFAULT_AVIATOR_CONFIG)
    const second = crashPointFor('av-1', DEFAULT_AVIATOR_CONFIG)

    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(1)
    expect(first).toBeLessThanOrEqual(DEFAULT_AVIATOR_CONFIG.maxCrash)
  })

  it('uses a configurable house edge and maximum crash', () => {
    const relaxed = crashPointFor('av-7', {
      ...DEFAULT_AVIATOR_CONFIG,
      maxCrash: 40,
      houseEdge: 0.08,
    })

    expect(relaxed).toBeLessThanOrEqual(40)
    expect(relaxed).toBeGreaterThanOrEqual(1)
  })
})

describe('aviator rounds', () => {
  const config = {
    ...DEFAULT_AVIATOR_CONFIG,
    roundMs: 30_000,
    waitMs: 6_000,
    growth: 0.14,
  }

  it('starts waiting and then flies before the crash completes', () => {
    const waiting = aviatorRoundAt(new Date('2026-01-01T00:00:00.000Z'), config)
    expect(waiting.phase).toBe('WAITING')

    const flying = aviatorRoundAt(new Date('2026-01-01T00:00:06.000Z'), config)
    expect(flying.phase).toBe('FLYING')
    expect(flying.multiplier).toBeGreaterThanOrEqual(1)
  })

  it('computes the next round after a completed cycle', () => {
    const round = aviatorRoundAt(new Date('2026-01-01T00:00:30.000Z'), config)
    const next = aviatorRoundAt(
      new Date(new Date(round.endsAtIso).getTime() + 1),
      config,
    )

    expect(next.index).toBe(round.index + 1)
    expect(next.phase).toBe('WAITING')
  })
})

describe('aviator configuration', () => {
  it('normalizes the operator settings', () => {
    const config = normalizeAviatorConfig({
      waitMs: 6000,
      roundMs: 30_000,
      growth: 0.14,
      maxCrash: 25,
      houseEdge: 0.05,
      enabled: true,
    })

    expect(config.enabled).toBe(true)
    expect(config.waitMs).toBe(6_000)
    expect(config.roundMs).toBe(30_000)
    expect(config.growth).toBe(0.14)
    expect(config.maxCrash).toBe(25)
    expect(config.houseEdge).toBe(0.05)
    expect(aviatorConfigFitsCycle(config)).toBe(true)
  })

  it('keeps the default cycle valid', () => {
    expect(aviatorConfigFitsCycle(DEFAULT_AVIATOR_CONFIG)).toBe(true)
  })
})
