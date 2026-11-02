import { describe, expect, it } from 'vitest'
import { isSameOrigin } from './origin'

function request(origin?: string, url = 'http://localhost:3100/api/auth/sign-in') {
  return new Request(url, {
    method: 'POST',
    headers: origin ? { origin } : undefined,
  })
}

describe('isSameOrigin', () => {
  it('allows the request host even when APP_URL uses a different local port', () => {
    expect(isSameOrigin(request('http://localhost:3100'))).toBe(true)
  })

  it('rejects cross-site origins', () => {
    expect(isSameOrigin(request('https://evil.example'))).toBe(false)
  })

  it('allows requests without an Origin header', () => {
    expect(isSameOrigin(request())).toBe(true)
  })
})
