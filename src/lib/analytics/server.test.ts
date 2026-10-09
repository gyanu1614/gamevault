import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureServerEvent } from './server'

const KEY = 'phc_test_key'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('captureServerEvent', () => {
  it('sends nothing without a project key (tests, local, preview)', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await captureServerEvent({ event: 'order_paid', distinctId: 'u1', props: { total_usd: 10 } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts one cleaned event to the EU capture endpoint', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', KEY)
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await captureServerEvent({
      event: 'order_paid',
      distinctId: 'user-uuid',
      props: { order_id: 'o1', total_usd: 12.5, email: 'a@b.com' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      api_key: KEY,
      event: 'order_paid',
      distinct_id: 'user-uuid',
      properties: { order_id: 'o1', total_usd: 12.5, $lib: 'dropmarket-server' },
    })
    expect(body.properties.email).toBeUndefined()
  })

  it('sends nothing from a local dev server', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', KEY)
    vi.stubEnv('NODE_ENV', 'development')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await captureServerEvent({ event: 'order_paid', distinctId: 'u1', props: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when PostHog is down or slow', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', KEY)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    await expect(captureServerEvent({ event: 'order_paid', distinctId: 'u', props: {} })).resolves.toBeUndefined()
  })
})
