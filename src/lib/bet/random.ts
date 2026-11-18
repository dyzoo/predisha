import { randomBytes, randomInt } from 'node:crypto'

export { hashString, mulberry32 } from './random-pure'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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
