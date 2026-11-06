/**
 * A public read that fails must throw. supabase-js returns failures as
 * `{ data: null, error }`, and most readers treat null as "nothing there", so a
 * database outage used to be saved as an empty page or a 404 (2026-11-05: the
 * Supabase block left /murder-mystery-2/buy-items/item/chroma-mortal a cached
 * 404 while the item still existed). A throw keeps the last good copy: Next
 * rethrows it out of a static render and Vercel keeps serving what it has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAnonClient, createTaggedAnonClient } from './anon'
import { PublicReadError, rethrowFailedRead, strictReads } from './failed-read'
import { createClient } from '@supabase/supabase-js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The answers the fake database gives, in order; the last one repeats. */
function database(...answers: Array<Response | Error>) {
  const calls: Array<{ url: string; method: string; init?: RequestInit }> = []
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', init })
      const answer = answers[Math.min(i++, answers.length - 1)]
      if (answer instanceof Error) throw answer
      return answer.clone()
    }),
  )
  return calls
}

describe('createAnonClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('hands back rows on a good read, through a full filter chain', async () => {
    database(json([{ id: 1 }]))
    const { data, error } = await createAnonClient().from('games').select('id').eq('slug', 'x').order('id').limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: 1 }])
  })

  it('throws when the project is blocked (the 2026-11-05 outage answered 402)', async () => {
    database(json({ message: 'exceed_cached_egress_quota' }, 402))
    await expect(createAnonClient().from('games').select('id')).rejects.toMatchObject({
      name: 'PublicReadError',
      status: 402,
      message: expect.stringContaining('exceed_cached_egress_quota'),
    })
  })

  it('throws when the database stays down after the retry', async () => {
    const calls = database(json({ message: 'upstream timeout' }, 504))
    await expect(createAnonClient().from('games').select('id')).rejects.toBeInstanceOf(PublicReadError)
    expect(calls).toHaveLength(2)
  })

  it('throws when the network fails, which supabase-js would otherwise hide', async () => {
    database(new TypeError('fetch failed'))
    await expect(createAnonClient().from('games').select('id')).rejects.toBeInstanceOf(PublicReadError)
  })

  it('throws on a query the database refuses, such as a column not pushed yet', async () => {
    database(json({ code: '42703', message: 'column games.nope does not exist' }, 400))
    await expect(createAnonClient().from('games').select('nope')).rejects.toBeInstanceOf(PublicReadError)
  })

  it('a missing row is an answer, not a failure: maybeSingle gives null', async () => {
    database(json([]))
    const { data, error } = await createAnonClient().from('games').select('id').eq('slug', 'x').maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('a missing row is an answer, not a failure: single keeps its PGRST116', async () => {
    database(json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406))
    const { data, error } = await createAnonClient().from('games').select('id').eq('slug', 'x').single()
    expect(data).toBeNull()
    expect(error?.code).toBe('PGRST116')
  })

  it('reading past the last page is an answer, not a failure', async () => {
    database(json({ code: 'PGRST103', message: 'Requested range not satisfiable' }, 416))
    const { error } = await createAnonClient().from('games').select('id').range(5000, 5999)
    expect(error?.code).toBe('PGRST103')
  })

  it('tries a read once more, so one slow answer never costs a page or a release', async () => {
    const calls = database(json({ message: 'upstream timeout' }, 504), json([{ id: 1 }]))
    const { data } = await createAnonClient().from('games').select('id')
    expect(data).toEqual([{ id: 1 }])
    expect(calls).toHaveLength(2)
  })

  it('the second try carries a signal: React returns the first answer again without one', async () => {
    const calls = database(json({ message: 'upstream timeout' }, 504), json([]))
    await createAnonClient().from('games').select('id')
    expect(calls[1].init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('does not retry a refusal, which would only fail the same way', async () => {
    const calls = database(json({ message: 'exceed_cached_egress_quota' }, 402))
    await expect(createAnonClient().from('games').select('id')).rejects.toBeInstanceOf(PublicReadError)
    expect(calls).toHaveLength(1)
  })

  it('never repeats an rpc, which is a POST and may write', async () => {
    const calls = database(json({ message: 'upstream timeout' }, 504))
    await expect(createAnonClient().rpc('public_game_players')).rejects.toBeInstanceOf(PublicReadError)
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
  })

  it('an rpc that works hands back its data', async () => {
    database(json([{ players: 5 }]))
    const { data } = await createAnonClient().rpc('public_game_players')
    expect(data).toEqual([{ players: 5 }])
  })
})

describe('createTaggedAnonClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('throws on a failed read and keeps its tags on both tries', async () => {
    const calls = database(json({ message: 'down' }, 500))
    await expect(createTaggedAnonClient({ tags: ['values:x'] }).from('games').select('id')).rejects.toBeInstanceOf(
      PublicReadError,
    )
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect((call.init as { next?: { tags?: string[] } }).next?.tags).toEqual(['values:x'])
    }
  })
})

describe('strictReads', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('makes a service-role client on a public read throw too', async () => {
    database(json({ message: 'down' }, 500))
    const db = strictReads(createClient('https://db.example', 'service-key', { auth: { persistSession: false } }))
    await expect(db.from('games').select('id')).rejects.toBeInstanceOf(PublicReadError)
  })
})

describe('rethrowFailedRead', () => {
  it('lets a failed read through a catch', () => {
    expect(() => rethrowFailedRead(new PublicReadError('down', 500))).toThrow(PublicReadError)
  })

  it('recognises one from another copy of this module (Next bundles server code per layer)', () => {
    const elsewhere = Object.assign(new Error('down'), { name: 'PublicReadError' })
    expect(() => rethrowFailedRead(elsewhere)).toThrow('down')
  })

  it('leaves every other error to the catch that holds it', () => {
    expect(() => rethrowFailedRead(new Error('bad json'))).not.toThrow()
    expect(() => rethrowFailedRead('text')).not.toThrow()
    expect(() => rethrowFailedRead(null)).not.toThrow()
  })
})
