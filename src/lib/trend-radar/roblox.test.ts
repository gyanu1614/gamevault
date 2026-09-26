import { describe, it, expect } from 'vitest'
import getSortsFixture from './__fixtures__/roblox-get-sorts.json'
import sortContentFixture from './__fixtures__/roblox-get-sort-content.json'
import gamesBatchFixture from './__fixtures__/roblox-games-batch.json'
import {
  parseSortsResponse,
  parseSortContentResponse,
  parseGamesBatch,
  chunk,
  createPacer,
  RobloxThrottleTripped,
  RobloxEndpointError,
  robloxGet,
  fetchSorts,
  fetchGameMetrics,
  METRICS_BATCH_SIZE,
  RADAR_SESSION_ID,
  type FetchLike,
} from './roblox'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/** A pacer that never sleeps and never trips — for tests that are not about pacing. */
const instantPacer = () => createPacer({ minIntervalMs: 0, jitterMs: 0, sleep: async () => {} })

describe('parseSortsResponse', () => {
  it('splits the three sorts the radar uses and drops non-game sorts', () => {
    const s = parseSortsResponse(getSortsFixture)
    expect(s.topPlayingNow).toHaveLength(35)
    expect(s.topTrending).toHaveLength(6)
    expect(s.upAndComing).toHaveLength(6)
  })

  it('keeps the identity and metric fields per game', () => {
    const s = parseSortsResponse(getSortsFixture)
    expect(s.topPlayingNow[0]).toEqual({
      universeId: 10563114921,
      rootPlaceId: expect.any(Number),
      name: 'Steal An Egg',
      playerCount: 2034139,
      isSponsored: false,
      upVotes: expect.any(Number),
      downVotes: expect.any(Number),
    })
  })

  it('drops sponsored entries — a paid slot is not a trend', () => {
    const body = {
      sorts: [{ sortId: 'top-playing-now', contentType: 'Games', games: [
        { universeId: 1, rootPlaceId: 1, name: 'Ad', playerCount: 999999, isSponsored: true },
        { universeId: 2, rootPlaceId: 2, name: 'Real', playerCount: 10, isSponsored: false },
      ] }],
    }
    expect(parseSortsResponse(body).topPlayingNow.map((g) => g.universeId)).toEqual([2])
  })

  it('returns empty lists for a body with no sorts', () => {
    expect(parseSortsResponse({})).toEqual({ topPlayingNow: [], topTrending: [], upAndComing: [] })
  })
})

describe('parseSortContentResponse', () => {
  it('reads the single-sort payload the fallback endpoint returns', () => {
    const games = parseSortContentResponse(sortContentFixture)
    expect(games).toHaveLength(35)
    expect(games[0].name).toBe('Steal An Egg')
  })
})

describe('parseGamesBatch', () => {
  it('maps the games API row to the metrics the radar stores', () => {
    const rows = parseGamesBatch(gamesBatchFixture)
    expect(rows[0]).toEqual({
      universeId: 10563114921,
      rootPlaceId: expect.any(Number),
      name: 'Steal An Egg',
      playing: 2028896,
      visits: 4026689367,
      favorites: 4671184,
      created: '2026-07-25T07:50:51.492Z',
    })
    expect(rows).toHaveLength(5)
  })
})

describe('chunk', () => {
  it('splits ids into batches of the API limit (50, measured live 2026-09-18)', () => {
    expect(METRICS_BATCH_SIZE).toBe(50)
    const ids = Array.from({ length: 120 }, (_, i) => i + 1)
    const c = chunk(ids, 50)
    expect(c.map((b) => b.length)).toEqual([50, 50, 20])
  })
})

describe('createPacer', () => {
  it('spaces calls at least minInterval apart, plus jitter', async () => {
    const sleeps: number[] = []
    let t = 0
    const pacer = createPacer({
      minIntervalMs: 1000,
      jitterMs: 250,
      now: () => t,
      sleep: async (ms) => { sleeps.push(ms); t += ms },
      random: () => 0.5,
    })
    await pacer.wait() // first call: no wait
    await pacer.wait() // second: 1000 + 125 jitter
    expect(sleeps).toEqual([1125])
  })

  it('does not sleep when enough time has already passed', async () => {
    const sleeps: number[] = []
    let t = 0
    const pacer = createPacer({ minIntervalMs: 1000, jitterMs: 0, now: () => t, sleep: async (ms) => { sleeps.push(ms) } })
    await pacer.wait()
    t += 5000
    await pacer.wait()
    expect(sleeps).toEqual([])
  })

  it('trips on the SECOND 429 of a run, not the first', () => {
    const pacer = instantPacer()
    expect(() => pacer.record429()).not.toThrow()
    expect(() => pacer.record429()).toThrow(RobloxThrottleTripped)
    expect(pacer.rateLimitHits).toBe(2)
  })
})

describe('robloxGet', () => {
  it('sends the browser UA Roblox expects and waits on the pacer before each call', async () => {
    const seen: { url: string; ua: string | null }[] = []
    const fetchImpl: FetchLike = async (url, init) => {
      seen.push({ url: String(url), ua: new Headers(init?.headers).get('user-agent') })
      return json({ ok: 1 })
    }
    let waits = 0
    const pacer = { ...instantPacer(), wait: async () => { waits += 1 } }
    await robloxGet('https://games.roblox.com/v1/games?universeIds=1', { fetchImpl, pacer })
    expect(waits).toBe(1)
    expect(seen[0].ua).toMatch(/Mozilla/)
  })

  it('retries ONCE after the first 429, honouring Retry-After', async () => {
    let calls = 0
    const fetchImpl: FetchLike = async () => {
      calls += 1
      return calls === 1 ? json({}, 429, { 'retry-after': '2' }) : json({ data: [] })
    }
    const sleeps: number[] = []
    const pacer = createPacer({ minIntervalMs: 0, jitterMs: 0, sleep: async (ms) => { sleeps.push(ms) } })
    const res = await robloxGet('https://x', { fetchImpl, pacer })
    expect(res.status).toBe(200)
    expect(calls).toBe(2)
    expect(sleeps).toContain(2000)
    expect(pacer.rateLimitHits).toBe(1)
  })

  it('ends the run on the second 429 instead of retrying through it', async () => {
    const fetchImpl: FetchLike = async () => json({}, 429)
    const pacer = instantPacer()
    await expect(robloxGet('https://x', { fetchImpl, pacer })).rejects.toBeInstanceOf(RobloxThrottleTripped)
    expect(pacer.rateLimitHits).toBe(2)
  })
})

describe('fetchSorts', () => {
  it('uses get-sorts with the documented opaque sessionId', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => { urls.push(String(url)); return json(getSortsFixture) }
    const s = await fetchSorts({ fetchImpl, pacer: instantPacer() })
    expect(s.endpoint).toBe('get-sorts')
    expect(s.topPlayingNow[0].name).toBe('Steal An Egg')
    expect(urls[0]).toContain('apis.roblox.com/explore-api/v1/get-sorts')
    expect(urls[0]).toContain(`sessionId=${RADAR_SESSION_ID}`)
    expect(RADAR_SESSION_ID).toBe('dropmarket-radar')
  })

  it('falls back to get-sort-content when get-sorts fails or returns no top-playing-now', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(String(url))
      if (String(url).includes('get-sorts')) return json({ sorts: [] })
      return json(sortContentFixture)
    }
    const s = await fetchSorts({ fetchImpl, pacer: instantPacer() })
    expect(s.endpoint).toBe('get-sort-content')
    expect(s.topPlayingNow).toHaveLength(35)
    expect(urls.some((u) => u.includes('get-sort-content') && u.includes('sortId=top-playing-now'))).toBe(true)
  })

  it('throws an endpoint error naming both attempts when everything fails', async () => {
    const fetchImpl: FetchLike = async () => json({ errors: [{ code: 0 }] }, 404)
    const err = await fetchSorts({ fetchImpl, pacer: instantPacer() }).catch((e) => e)
    expect(err).toBeInstanceOf(RobloxEndpointError)
    expect(err.health).toEqual({
      endpoint: 'get-sort-content',
      status: 404,
      fallbackTried: true,
      attempts: [
        { endpoint: 'get-sorts', status: 404 },
        { endpoint: 'get-sort-content', status: 404 },
      ],
    })
  })
})

describe('fetchGameMetrics', () => {
  it('batches ids by 50 and merges the rows', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(String(url))
      const ids = new URL(String(url)).searchParams.get('universeIds')!.split(',')
      return json({ data: ids.map((id) => ({ id: Number(id), name: `g${id}`, playing: 1, visits: 2, favoritedCount: 3, created: 'c' })) })
    }
    const ids = Array.from({ length: 101 }, (_, i) => i + 1)
    const rows = await fetchGameMetrics(ids, { fetchImpl, pacer: instantPacer() })
    expect(urls).toHaveLength(3)
    expect(rows).toHaveLength(101)
    expect(rows[100].universeId).toBe(101)
  })

  it('de-duplicates ids before batching', async () => {
    let calls = 0
    const fetchImpl: FetchLike = async () => { calls += 1; return json({ data: [] }) }
    await fetchGameMetrics([1, 1, 1, 2], { fetchImpl, pacer: instantPacer() })
    expect(calls).toBe(1)
  })

  it('surfaces a non-429 failure as an endpoint error with the status', async () => {
    const fetchImpl: FetchLike = async () => json({ errors: [{ code: 9 }] }, 400)
    const err = await fetchGameMetrics([1], { fetchImpl, pacer: instantPacer() }).catch((e) => e)
    expect(err).toBeInstanceOf(RobloxEndpointError)
    expect(err.health.endpoint).toBe('games')
    expect(err.health.status).toBe(400)
  })
})
