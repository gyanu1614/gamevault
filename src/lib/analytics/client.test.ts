import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_config: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}))
vi.mock('posthog-js', () => ({ default: ph }))

async function freshClient() {
  vi.resetModules()
  return import('./client')
}

beforeEach(() => {
  for (const f of Object.values(ph)) f.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe('analytics client', () => {
  it('does nothing at all without a project key', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '')
    const c = await freshClient()
    c.track('listing_viewed', { game: 'mm2' })
    await c.startAnalytics()
    expect(ph.init).not.toHaveBeenCalled()
    expect(ph.capture).not.toHaveBeenCalled()
  })

  it('inits cookieless on our proxy path by default, with click autocapture and no replay', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await c.startAnalytics()
    expect(ph.init).toHaveBeenCalledTimes(1)
    const [key, cfg] = ph.init.mock.calls[0]
    expect(key).toBe('phc_x')
    expect(cfg).toMatchObject({
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      persistence: 'memory',
      disable_session_recording: true,
      capture_heatmaps: false,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
      capture_pageview: 'history_change',
      person_profiles: 'identified_only',
    })
    expect(typeof cfg.before_send).toBe('function')
  })

  it('before_send strips private URL parts', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await c.startAnalytics()
    const cfg = ph.init.mock.calls[0][1]
    const out = cfg.before_send({ event: '$pageview', properties: { $current_url: 'https://dropmarket.gg/x?email=a&utm_source=yt' } })
    expect(out.properties.$current_url).toBe('https://dropmarket.gg/x?utm_source=yt')
  })

  it('queues events and identity until PostHog has loaded, then replays them in order', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    c.track('listing_viewed', { listing_id: 'l1', email: 'a@b.com' })
    c.identify('user-1')
    expect(ph.capture).not.toHaveBeenCalled()
    await c.startAnalytics()
    expect(ph.capture).toHaveBeenCalledWith('listing_viewed', { listing_id: 'l1' })
    expect(ph.identify).toHaveBeenCalledWith('user-1')
  })

  it('sends straight away once loaded; reset clears the identity', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await c.startAnalytics()
    c.track('checkout_started', { listing_id: 'l2', qty: 2 })
    c.reset()
    expect(ph.capture).toHaveBeenCalledWith('checkout_started', { listing_id: 'l2', qty: 2 })
    expect(ph.reset).toHaveBeenCalled()
  })

  it('sends a step that precedes a full-page redirect by beacon', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await c.startAnalytics()
    c.track('checkout_submitted', { method: 'crypto' }, { beacon: true })
    expect(ph.capture).toHaveBeenCalledWith('checkout_submitted', { method: 'crypto' }, { transport: 'sendBeacon' })
  })

  it('sends nothing from localhost (dev and test visits stay out of the data)', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    vi.stubGlobal('location', { hostname: 'localhost' })
    const c = await freshClient()
    c.track('listing_viewed', { listing_id: 'l1' })
    await c.startAnalytics()
    expect(ph.init).not.toHaveBeenCalled()
    expect(ph.capture).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('loads once even if started twice', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await Promise.all([c.startAnalytics(), c.startAnalytics()])
    expect(ph.init).toHaveBeenCalledTimes(1)
  })
})

describe('analytics consent', () => {
  // Node test env: give the client a window with a working localStorage.
  const mem = new Map<string, string>()
  const fakeStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v) },
    removeItem: (k: string) => { mem.delete(k) },
  }
  beforeEach(() => { mem.clear(); vi.stubGlobal('window', { localStorage: fakeStorage }) })
  afterEach(() => vi.unstubAllGlobals())
  it('Accept on an earlier visit inits with cookies and replay', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    fakeStorage.setItem('dm.analytics.consent', 'granted')
    const c = await freshClient()
    await c.startAnalytics()
    const cfg = ph.init.mock.calls.at(-1)![1]
    expect(cfg).toMatchObject({ persistence: 'localStorage+cookie', disable_session_recording: false, capture_heatmaps: true })
  })

  it('setAnalyticsConsent switches the running instance and remembers the choice', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_x')
    const c = await freshClient()
    await c.startAnalytics()
    c.setAnalyticsConsent('granted')
    expect(fakeStorage.getItem('dm.analytics.consent')).toBe('granted')
    expect(ph.set_config).toHaveBeenCalledWith(expect.objectContaining({ persistence: 'localStorage+cookie' }))
    expect(ph.startSessionRecording).toHaveBeenCalled()
    c.setAnalyticsConsent('denied')
    expect(fakeStorage.getItem('dm.analytics.consent')).toBe('denied')
    expect(ph.set_config).toHaveBeenLastCalledWith(expect.objectContaining({ persistence: 'memory', disable_session_recording: true }))
    expect(ph.stopSessionRecording).toHaveBeenCalled()
  })
})
