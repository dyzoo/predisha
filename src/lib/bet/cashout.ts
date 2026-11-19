import { hashString } from './random-pure'

export type CashoutOutcome = 'WIN' | 'LOSE' | 'MIXED' | 'UNKNOWN'

export interface CashoutQuoteInput {
  stakeMinor: number
  potentialReturnMinor: number
  outcome: CashoutOutcome
  progress: number
  seed?: string
  now?: number
}

export interface CashoutQuote {
  offer: number
  blocked: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function buildCashoutQuote(input: CashoutQuoteInput): CashoutQuote {
  const stake = Math.max(0, Math.floor(input.stakeMinor))
  const potential = Math.max(stake, Math.floor(input.potentialReturnMinor))
  const progress = clamp(input.progress, 0, 1)

  let raw: number
  if (input.outcome === 'WIN') {
    raw = potential * (0.78 + 0.17 * progress)
  } else if (input.outcome === 'LOSE') {
    raw = stake * (0.55 - 0.12 * progress)
  } else if (input.outcome === 'MIXED') {
    raw = stake * (0.62 + 0.22 * progress) + (potential - stake) * 0.2 * progress
  } else {
    raw = stake * (0.8 + 0.1 * progress)
  }

  const bucket = Math.floor((input.now ?? Date.now()) / 30_000)
  const bonus = input.seed ? ((hashString(`${input.seed}:cashout:${bucket}`) % 16) / 1000) : 0
  const offer = Math.floor(raw * (1 + bonus))
  return {
    offer: Math.floor(clamp(offer, stake * 0.4, potential)),
    blocked: false,
  }
}
