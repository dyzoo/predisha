'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
} from 'lucide-react'
import { signInSchema, signUpSchema, zodFieldErrors } from '@/lib/auth/credentials'
import { safeNextPath, withNextPath } from '@/lib/auth/redirect'
import { useViewer } from '@/components/ui/viewer-provider'

interface AuthShellProps {
  mode: 'sign-in' | 'sign-up'
  authConfigured: boolean
  nextPath?: string
}

type FieldName = 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptedTerms'
type FieldErrors = Partial<Record<FieldName, string>>

interface AuthResponse {
  error?: string
  fields?: Record<string, string>
  retryAfterSeconds?: number
}

const copy = {
  'sign-in': {
    eyebrow: 'Welcome back',
    title: 'Sign in to Predisha',
    intro: 'Pick up where you left off with saved matches and your matchday preferences.',
    submit: 'Sign in',
    pending: 'Signing in…',
    switchText: 'New to Predisha?',
    switchLabel: 'Create an account',
    switchHref: '/sign-up',
  },
  'sign-up': {
    eyebrow: 'Create account',
    title: 'Join Predisha',
    intro: 'Save matches, set your timezone, and follow the model — free to start.',
    submit: 'Create account',
    pending: 'Creating account…',
    switchText: 'Already have an account?',
    switchLabel: 'Sign in',
    switchHref: '/sign-in',
  },
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 text-[11px] leading-relaxed text-red-300">
      {message}
    </p>
  )
}

function retryMessage(seconds?: number): string {
  if (!seconds || seconds < 1) return 'Too many attempts. Try again later.'
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

export function AuthShell({ mode, authConfigured, nextPath }: AuthShellProps) {
  const content = copy[mode]
  const router = useRouter()
  const { refreshViewer } = useViewer()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)

  const safeNext = safeNextPath(nextPath)
  const switchHref = withNextPath(content.switchHref, safeNext)
  const forgotHref = withNextPath('/forgot-password', safeNext)

  function clearFieldError(field: FieldName) {
    setFieldErrors(current => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function validate(): FieldErrors {
    if (mode === 'sign-up') {
      const parsed = signUpSchema.safeParse({ name, email, password, acceptedTerms })
      const nextErrors: FieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error)
      if (!nextErrors.password && confirmPassword !== password) {
        nextErrors.confirmPassword = 'Passwords do not match.'
      }
      return nextErrors
    }

    const parsed = signInSchema.safeParse({ email, password })
    return parsed.success ? {} : zodFieldErrors(parsed.error)
  }

  function focusFirstError(errors: FieldErrors) {
    const first = (Object.keys(errors) as FieldName[])[0]
    if (!first) return
    requestAnimationFrame(() => {
      document.getElementById(`auth-${first}`)?.focus()
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!authConfigured || pending) return

    const nextErrors = validate()
    setFieldErrors(nextErrors)
    setError(null)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    setPending(true)
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'sign-up'
            ? { name, email, password, acceptedTerms }
            : { email, password },
        ),
      })
      const payload = (await response.json().catch(() => ({}))) as AuthResponse
      if (!response.ok) {
        const serverFields = payload.fields ?? {}
        setFieldErrors(serverFields)
        if (Object.keys(serverFields).length === 0) {
          setError(
            response.status === 429 ? retryMessage(payload.retryAfterSeconds) : (payload.error ?? 'Something went wrong. Please try again.'),
          )
        }
        return
      }
      await refreshViewer()
      router.replace(safeNext ?? '/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const inputShell = (field: FieldName) =>
    `flex items-center gap-2 rounded-xl border bg-background/50 px-3 py-2.5 transition-colors ${
      fieldErrors[field]
        ? 'border-red-400/50'
        : 'border-border focus-within:border-accent/60'
    }`

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-main-text sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-[#5B8CFF]/10 blur-[110px]" />
      </div>

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5" aria-label="Predisha home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-background shadow-[0_0_24px_rgba(200,255,67,0.35)]">
            <Sparkles className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Predisha<span className="text-accent">.</span>
          </span>
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-surface/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {content.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-text">{content.intro}</p>

          {!authConfigured ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-200">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Accounts are not live on this deployment. Authentication needs a configured
                database and <code>AUTH_SECRET</code>. The form stays disabled rather than faking a
                session.
              </p>
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <div
                id="auth-form-error"
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-xs leading-relaxed text-red-200"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            {mode === 'sign-up' ? (
              <div>
                <label
                  htmlFor="auth-name"
                  className="mb-1.5 block text-xs font-medium text-muted-text"
                >
                  Name
                </label>
                <div className={inputShell('name')}>
                  <User className="h-4 w-4 text-muted-text" />
                  <input
                    id="auth-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={event => {
                      setName(event.target.value)
                      clearFieldError('name')
                    }}
                    disabled={!authConfigured || pending}
                    placeholder="Your name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-text/60 disabled:cursor-not-allowed"
                  />
                </div>
                <FieldError id="auth-name-error" message={fieldErrors.name} />
              </div>
            ) : null}

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-xs font-medium text-muted-text"
              >
                Email
              </label>
              <div className={inputShell('email')}>
                <Mail className="h-4 w-4 text-muted-text" />
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  value={email}
                  onChange={event => {
                    setEmail(event.target.value)
                    clearFieldError('email')
                  }}
                  disabled={!authConfigured || pending}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-text/60 disabled:cursor-not-allowed"
                />
              </div>
              <FieldError id="auth-email-error" message={fieldErrors.email} />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-xs font-medium text-muted-text"
              >
                Password
              </label>
              <div className={inputShell('password')}>
                <Lock className="h-4 w-4 text-muted-text" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'sign-up' ? 12 : 1}
                  maxLength={200}
                  value={password}
                  onChange={event => {
                    setPassword(event.target.value)
                    clearFieldError('password')
                    clearFieldError('confirmPassword')
                  }}
                  disabled={!authConfigured || pending}
                  placeholder={mode === 'sign-up' ? 'Create a password' : 'Your password'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-text/60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  disabled={!authConfigured || pending}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="rounded-md p-1 text-muted-text transition-colors hover:text-main-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'sign-up' ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-text">
                  Use at least 12 characters. A short passphrase works well.
                </p>
              ) : null}
              <FieldError id="auth-password-error" message={fieldErrors.password} />
            </div>

            {mode === 'sign-up' ? (
              <>
                <div>
                  <label
                    htmlFor="auth-confirmPassword"
                    className="mb-1.5 block text-xs font-medium text-muted-text"
                  >
                    Confirm password
                  </label>
                  <div className={inputShell('confirmPassword')}>
                    <Lock className="h-4 w-4 text-muted-text" />
                    <input
                      id="auth-confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                      maxLength={200}
                      value={confirmPassword}
                      onChange={event => {
                        setConfirmPassword(event.target.value)
                        clearFieldError('confirmPassword')
                      }}
                      disabled={!authConfigured || pending}
                      placeholder="Repeat your password"
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                      aria-describedby={
                        fieldErrors.confirmPassword ? 'auth-confirmPassword-error' : undefined
                      }
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-text/60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <FieldError
                    id="auth-confirmPassword-error"
                    message={fieldErrors.confirmPassword}
                  />
                </div>

                <div>
                  <div className="flex items-start gap-2.5">
                    <input
                      id="auth-acceptedTerms"
                      type="checkbox"
                      name="acceptedTerms"
                      checked={acceptedTerms}
                      onChange={event => {
                        setAcceptedTerms(event.target.checked)
                        clearFieldError('acceptedTerms')
                      }}
                      disabled={!authConfigured || pending}
                      aria-invalid={Boolean(fieldErrors.acceptedTerms)}
                      aria-describedby={
                        fieldErrors.acceptedTerms ? 'auth-acceptedTerms-error' : undefined
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <label
                      htmlFor="auth-acceptedTerms"
                      className="text-xs leading-relaxed text-muted-text"
                    >
                      I agree to the{' '}
                      <Link href="/terms" className="font-medium text-accent hover:underline">
                        Terms
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="font-medium text-accent hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>
                  <FieldError id="auth-acceptedTerms-error" message={fieldErrors.acceptedTerms} />
                </div>
              </>
            ) : null}

            <button
              type="submit"
              disabled={!authConfigured || pending}
              aria-busy={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-background/60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending ? content.pending : content.submit}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-text">
            {content.switchText}{' '}
            <Link href={switchHref} className="font-semibold text-accent hover:underline">
              {content.switchLabel}
            </Link>
          </p>
          {mode === 'sign-in' ? (
            <p className="mt-2 text-center text-xs text-muted-text">
              <Link href={forgotHref} className="hover:text-accent hover:underline">
                Forgot your password?
              </Link>
            </p>
          ) : null}
        </div>

        <Link
          href="/"
          className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs font-medium text-muted-text transition-colors hover:text-main-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  )
}
