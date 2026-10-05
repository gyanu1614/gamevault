/**
 * The tagged anon client is what makes `revalidateTag` refresh values DATA:
 * Next 14 caches an un-annotated server fetch on a static route with the
 * page's window and no tags, so a tag-triggered re-render used to reuse the
 * old query responses (Adopt Me pet pages, 2026-10-05). These pin that every
 * supabase-js request carries `next.tags` (+ revalidate when given), keeps the
 * request supabase built, and folds the tags into the cache key via a header.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CACHE_TAGS_KEY_HEADER, createTaggedAnonClient, taggedFetch } from './anon'

type Init = RequestInit & { next?: { tags?: string[]; revalidate?: number | false; internal?: boolean } }

describe('taggedFetch', () => {
  it('forwards tags + revalidate and preserves the request init', async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: Init) => new Response('[]'))
    const signal = new AbortController().signal
    const f = taggedFetch({ tags: ['price:adopt-me:owl', 'values:adopt-me'], revalidate: 600 }, base as typeof fetch)

    await f('https://db.example/rest/v1/pets?select=id', {
      method: 'POST',
      body: '{"a":1}',
      signal,
      headers: { apikey: 'anon', Prefer: 'count=exact' },
      next: { internal: false },
    } as Init)

    const [input, init] = base.mock.calls[0]
    expect(input).toBe('https://db.example/rest/v1/pets?select=id')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"a":1}')
    expect(init?.signal).toBe(signal)
    expect(init?.next).toEqual({ internal: false, tags: ['price:adopt-me:owl', 'values:adopt-me'], revalidate: 600 })
    const headers = new Headers(init?.headers)
    expect(headers.get('apikey')).toBe('anon')
    expect(headers.get('prefer')).toBe('count=exact')
    // In the cache key: a different tag set is a different entry, and entries
    // written before the wrapper (no header) are never served.
    expect(headers.get(CACHE_TAGS_KEY_HEADER)).toBe('price:adopt-me:owl,values:adopt-me')
  })

  it('omits revalidate when not given, so the route segment window applies', async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: Init) => new Response('[]'))
    await taggedFetch({ tags: ['values:x', 'values:x'] }, base as typeof fetch)('https://db.example/a')
    const init = base.mock.calls[0][1]
    expect(init?.next).toEqual({ tags: ['values:x'] })
    expect('revalidate' in (init?.next ?? {})).toBe(false)
  })

  it('resolves the global fetch per call (Next patches it after module load)', async () => {
    const f = taggedFetch({ tags: ['t'] })
    const patched = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', patched)
    try {
      await f('https://db.example/a')
      expect(patched).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('createTaggedAnonClient', () => {
  const calls: Array<[string, Init | undefined]> = []
  beforeEach(() => {
    calls.length = 0
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: Init) => {
        calls.push([String(input), init])
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('every supabase-js query carries the tags, with the anon auth intact', async () => {
    const sb = createTaggedAnonClient({ tags: ['price:steal-a-brainrot', 'values:steal-a-brainrot'] })
    await sb.from('sab_price_display').select('brainrot_id').eq('mutation_slug', 'default')

    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]
    expect(url).toContain('/rest/v1/sab_price_display')
    expect(url).toContain('mutation_slug=eq.default')
    expect(init?.next?.tags).toEqual(['price:steal-a-brainrot', 'values:steal-a-brainrot'])
    const headers = new Headers(init?.headers)
    expect(headers.get('apikey')).toBe('anon-key')
    expect(headers.get('authorization')).toBe('Bearer anon-key')
    expect(headers.get(CACHE_TAGS_KEY_HEADER)).toBe('price:steal-a-brainrot,values:steal-a-brainrot')
  })
})
