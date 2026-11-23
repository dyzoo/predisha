import { describe, expect, it, vi } from 'vitest'
import { BetError, handleBetError } from './errors'

describe('handleBetError', () => {
  it('preserves domain errors', async () => {
    const response = handleBetError(new BetError('Bad stake.', 422, 'BAD_STAKE'))
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Bad stake.',
      code: 'BAD_STAKE',
    })
  })

  it('reports an unavailable database as a retryable 503', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = handleBetError(
      new Error('Error querying the database: Your account or project has exceeded the quota.'),
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    })
    errorSpy.mockRestore()
  })

  it('keeps unknown failures as a 500', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = handleBetError(new Error('Unexpected failure'))
    expect(response.status).toBe(500)
    errorSpy.mockRestore()
  })
})
