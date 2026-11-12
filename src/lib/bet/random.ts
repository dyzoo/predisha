import { randomBytes, randomInt } from 'node:crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function randomCode(length = 6): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let index = 0; index < length; index += 1) {
    result += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length]
  }
  return result
}

export function secureInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer')
  }
  return randomInt(maxExclusive)
}

export function pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (total <= 0) return items[0].value
  let roll = secureInt(total)
  for (const item of items) {
    roll -= Math.max(0, item.weight)
    if (roll < 0) return item.value
  }
  return items[items.length - 1].value
}
