import { describe, expect, it } from 'vitest'
import { ingestRequestHeaders, ingestUpstream, trailingSlashRedirectUrl, trailingSlashTarget, INGEST_PATH } from './ingest-proxy'

describe('ingestUpstream', () => {
  it('maps event calls to the EU ingestion host', () => {
    expect(ingestUpstream(`${INGEST_PATH}/i/v0/e/`, '?ip=0&ver=1')?.toString()).toBe('https://eu.i.posthog.com/i/v0/e/?ip=0&ver=1')
  })

  it('maps static and array assets to the EU assets host', () => {
    expect(ingestUpstream(`${INGEST_PATH}/static/array.js`, '')?.toString()).toBe('https://eu-assets.i.posthog.com/static/array.js')
    expect(ingestUpstream(`${INGEST_PATH}/array/phc_x/config.js`, '')?.toString()).toBe(
      'https://eu-assets.i.posthog.com/array/phc_x/config.js',
    )
  })

  it('ignores every other path', () => {
    expect(ingestUpstream('/ingestion-guide', '')).toBeNull()
    expect(ingestUpstream('/adopt-me', '')).toBeNull()
  })
})

describe('ingestRequestHeaders', () => {
  it('never forwards our cookies or auth headers to PostHog', () => {
    const h = ingestRequestHeaders(
      new Headers({
        cookie: 'sb-abc-auth-token=secret',
        authorization: 'Bearer x',
        'content-type': 'text/plain',
        'user-agent': 'UA',
      }),
      'eu.i.posthog.com',
    )
    expect(h.get('cookie')).toBeNull()
    expect(h.get('authorization')).toBeNull()
    expect(h.get('host')).toBe('eu.i.posthog.com')
    expect(h.get('content-type')).toBe('text/plain')
  })
})

describe('trailingSlashTarget (kept by middleware once Next skips its own redirect)', () => {
  it('strips one or more trailing slashes', () => {
    expect(trailingSlashTarget('/adopt-me/')).toBe('/adopt-me')
    expect(trailingSlashTarget('/adopt-me/values//')).toBe('/adopt-me/values')
  })

  it('leaves the root, clean paths and the ingest proxy alone', () => {
    expect(trailingSlashTarget('/')).toBeNull()
    expect(trailingSlashTarget('/adopt-me')).toBeNull()
    expect(trailingSlashTarget(`${INGEST_PATH}/e/`)).toBeNull()
  })
})

describe('trailingSlashRedirectUrl', () => {
  it('builds the slash-less URL with the query kept (plain URL: NextURL would re-add the slash)', () => {
    expect(trailingSlashRedirectUrl('https://dropmarket.gg/adopt-me/?utm_source=x')?.toString()).toBe(
      'https://dropmarket.gg/adopt-me?utm_source=x',
    )
  })

  it('is null when nothing needs to change', () => {
    expect(trailingSlashRedirectUrl('https://dropmarket.gg/adopt-me?x=1')).toBeNull()
    expect(trailingSlashRedirectUrl('https://dropmarket.gg/')).toBeNull()
  })
})
