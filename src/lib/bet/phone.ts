export interface NormalizedPhone {
  ok: boolean
  phone: string
  error?: string
}

/**
 * Normalize Tanzanian mobile numbers to the 255XXXXXXXXX form expected by
 * HarakaPay. Accepts +255..., 255..., 0... and 9-digit local numbers.
 */
export function normalizeTzPhone(input: string): NormalizedPhone {
  const raw = input.trim().replace(/[\s()-]/g, '')
  let digits = raw.replace(/\D/g, '')

  if (raw.startsWith('+')) digits = raw.slice(1).replace(/\D/g, '')
  if (digits.startsWith('00255')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 10) digits = `255${digits.slice(1)}`
  if (!digits.startsWith('255') && digits.length === 9) digits = `255${digits}`

  if (!/^255[67]\d{8}$/.test(digits)) {
    return {
      ok: false,
      phone: '',
      error: 'Enter a valid Tanzanian mobile number, for example 0712 345 678.',
    }
  }

  return { ok: true, phone: digits }
}

export function maskTzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  return `${digits.slice(0, 5)}•••${digits.slice(-2)}`
}
