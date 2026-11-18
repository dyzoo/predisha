import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeNextSmsNumbers, sendNextSms } from './nextsms'

describe('nextsms helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes and de-duplicates recipient numbers', () => {
    expect(normalizeNextSmsNumbers(['0712345678', '+255712345678', '255712345678'])).toEqual([
      '255712345678',
    ])
  })

  it('reports the provider rejection reason for a bad sender ID', async () => {
    vi.stubEnv('NEXTSMS_SENDER_ID', 'NEXTSMS')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            messageId: 'msg-1',
            status: {
              groupName: 'REJECTED',
              name: 'REJECTED_SOURCE',
              description: 'Sender ID in the request not registered on your account.',
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendNextSms({ to: ['0712345678'], text: 'Test message' })

    expect(result).toMatchObject({ success: false, sentCount: 0, failedCount: 1 })
    expect(result.error).toContain('REJECTED_SOURCE')
    expect(result.error).toContain('not registered')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://messaging-service.co.tz/api/sms/v2/text/single',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('treats an accepted message as sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ messageId: 'msg-2', status: { groupName: 'ACCEPTED', name: 'SUCCESS' } }],
        }),
      }),
    )

    await expect(sendNextSms({ to: ['255712345678'], text: 'Hello' })).resolves.toMatchObject({
      success: true,
      sentCount: 1,
      failedCount: 0,
      error: null,
      messageIds: ['msg-2'],
    })
  })
})
