const AUTH_PATHS = ['/sign-in', '/sign-up', '/forgot-password']

function decodeRepeatedly(value: string): string | null {
  let decoded = value
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      return null
    }
  }
  return decoded
}

/**
 * Only allow same-origin, non-auth, non-API paths as post-login destinations.
 * Backslashes and control characters are rejected because browsers normalise
 * them unpredictably during navigation.
 */
export function safeNextPath(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null

  const decoded = decodeRepeatedly(raw)
  if (!decoded || decoded.startsWith('//') || decoded.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return null

  let url: URL
  try {
    url = new URL(raw, 'http://predisha.local')
  } catch {
    return null
  }
  if (url.origin !== 'http://predisha.local') return null

  const path = `${url.pathname}${url.search}${url.hash}`
  const lower = path.toLowerCase()
  if (lower === '/api' || lower.startsWith('/api/') || lower.startsWith('/api?')) return null

  const isAuthPath = AUTH_PATHS.some(
    authPath =>
      lower === authPath ||
      lower.startsWith(`${authPath}/`) ||
      lower.startsWith(`${authPath}?`) ||
      lower.startsWith(`${authPath}#`),
  )
  if (isAuthPath) return null

  return path
}

export function withNextPath(href: string, nextPath: string | null): string {
  if (!nextPath) return href
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}next=${encodeURIComponent(nextPath)}`
}
