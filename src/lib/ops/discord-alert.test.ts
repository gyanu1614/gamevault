import { describe, it, expect, vi } from 'vitest'

import { postOpsAlert } from './discord-alert'

describe('postOpsAlert', () => {
  it('posts the content with mentions disabled', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    expect(await postOpsAlert('hello', { webhookUrl: 'https://discord.test/hook', fetchImpl })).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://discord.test/hook')
    expect(JSON.parse(init.body as string)).toEqual({ content: 'hello', allowed_mentions: { parse: [] } })
  })

  it('does nothing without a webhook URL', async () => {
    const fetchImpl = vi.fn()
    expect(await postOpsAlert('hello', { webhookUrl: '', fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never throws when Discord is down', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET') })
    await expect(postOpsAlert('hello', { webhookUrl: 'https://discord.test/hook', fetchImpl })).resolves.toBe(false)
  })
})
