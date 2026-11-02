import { describe, expect, it } from 'vitest'
import { signInSchema, signUpSchema, zodFieldErrors } from './credentials'

describe('signUpSchema', () => {
  it('accepts valid credentials and normalises the email', () => {
    const result = signUpSchema.safeParse({
      name: '  Ada Lovelace  ',
      email: '  ADA@Example.COM ',
      password: 'correct horse battery staple',
      acceptedTerms: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.name).toBe('Ada Lovelace')
    expect(result.data.email).toBe('ada@example.com')
  })

  it('rejects short passwords and missing consent', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'too-short',
      acceptedTerms: false,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toMatchObject({
      password: 'Use at least 12 characters for your password.',
      acceptedTerms: 'Accept the Terms and Privacy Policy to continue.',
    })
  })

  it('rejects invalid emails', () => {
    const result = signUpSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'not-an-email',
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
