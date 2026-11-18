import { describe, expect, it } from 'vitest'
import { signInSchema, signUpSchema, zodFieldErrors } from './credentials'

describe('signUpSchema', () => {
  it('accepts valid credentials and normalises the email', () => {
    const result = signUpSchema.safeParse({
      name: '  Ada Lovelace  ',
      email: '  ADA@Example.COM ',
      phone: '0712 345 678',
      password: 'correct horse battery staple',
      acceptedTerms: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.name).toBe('Ada Lovelace')
    expect(result.data.email).toBe('ada@example.com')
  })

  it('accepts an eight-character password', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '0712 345 678',
      password: 'password',
      acceptedTerms: true,
    })

    expect(result.success).toBe(true)
  })

  it('rejects short passwords and missing consent', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '0712 345 678',
      password: 'short',
      acceptedTerms: false,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toMatchObject({
      password: 'Use at least 8 characters for your password.',
      acceptedTerms: 'Accept the Terms and Privacy Policy to continue.',
    })
  })

  it('rejects an invalid mobile number', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123',
      password: 'correct horse battery staple',
      acceptedTerms: true,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toMatchObject({
      phone: 'Enter a valid Tanzanian mobile number, for example 0712 345 678.',
    })
  })

  it('rejects invalid emails', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'not-an-email',
      phone: '0712 345 678',
      password: 'correct horse battery staple',
      acceptedTerms: true,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toMatchObject({
      email: 'Enter a valid email address.',
    })
  })
})

describe('signInSchema', () => {
  it('requires an email and password', () => {
    const result = signInSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toMatchObject({
      email: 'Enter a valid email address.',
      password: 'Enter your password.',
    })
  })
})
