import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254, 'Email must be 254 characters or fewer.')

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(200, 'Password must be 200 characters or fewer.'),
})

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your name (at least 2 characters).')
    .max(80, 'Name must be 80 characters or fewer.'),
  email: emailSchema,
  password: z
    .string()
    .min(12, 'Use at least 12 characters for your password.')
    .max(200, 'Password must be 200 characters or fewer.'),
  acceptedTerms: z
    .boolean()
    .refine(value => value, 'Accept the Terms and Privacy Policy to continue.'),
})

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === 'string' ? issue.path[0] : 'form'
    fields[key] ??= issue.message
  }
  return fields
}
