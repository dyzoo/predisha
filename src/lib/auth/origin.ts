/**
 * Basic same-origin check for state-changing API requests. Cookies are also
 * SameSite=Lax, but this catches cross-site form posts that some browsers may
 * still send.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const requestUrl = new URL(request.url)
  const host = forwardedHost || request.headers.get('host') || requestUrl.host
  const protocol = forwardedProto || requestUrl.protocol.replace(':', '')

  const allowed = new Set(
    [
      process.env.APP_URL,
      process.env.AUTH_URL,
      host ? `${protocol}://${host}` : null,
      process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000',
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap(value => {
        try {
          return [new URL(value).origin]
        } catch {
          return []
        }
      }),
  )

  try {
    return allowed.has(new URL(origin).origin)
  } catch {
    return false
  }
}
