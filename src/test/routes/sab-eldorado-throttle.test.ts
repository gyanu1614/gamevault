import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { collectOne, earlyStopNotice, main } from '../../../scripts/collect-eldorado-sab-api-v6.mjs'
import { EldoradoBlockedError } from '../../../scripts/lib/eldorado-http.mjs'

/**
 * 2026-10-28/29: Eldorado answered the SAB crawl with 429 after ~60 of 420
 * brainrots, the collector threw before writing its feed, and the ~60
 * brainrots already read were discarded — nothing imported, and the expire,
 * reprice and freshness steps never ran. A throttle (or the crawl budget) now
 * ends the crawl cleanly: feed written with `stopped_early`, what was
 * collected imported, a warning annotated, exit 0. Everything is injected
 * (queue, collector, importer, clock); nothing touches Eldorado or Supabase.
 */

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']

function fakeQueue() {
  return async () => ({
    queue: NAMES.map((name) => ({
      id: `id-${name}`,
      name,
      slug: name.toLowerCase(),
      rarity: 'Secret',
      covered_mutations: 0,
      mutation_gap: 14,
      priority_score: 4420,
      current_confidence: 'missing',
      current_sample_size: 0,
      // Never priced → all eligible; equal staleness → alphabetical order.
      last_priced_at: null,
      rarity_weight: 1,
    })),
    mutations: [],
    totalMutations: 14,
    expectedIncomeByVariant: new Map(),
    totals: { catalog: NAMES.length, missing_default_prices: NAMES.length, low_default_prices: 0 },
  })
}

function result(name: string) {
  return {
    requested_url: `https://www.eldorado.gg/${name}`,
    final_url: `https://www.eldorado.gg/${name}`,
    api_url: null,
    api_candidates: 1,
    body_candidates: 0,
    income_filtered_candidates: 0,
    missing_income_range_candidates: 0,
    selected_income_bands: {},
    listings: [{ external_listing_id: `offer-${name}`, brainrot: name }],
    variants: { default: 1 },
    body_preview: '',
    trade_environment_attempts: [],
  }
}

const blocked = () =>
  new EldoradoBlockedError({ status: 429, url: 'https://www.eldorado.gg/api', blocks: 2, waitedMs: 60_000 })

let dir: string
let logs: string[]

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sab-throttle-'))
  logs = []
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.join(' '))
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', () => {
    throw new Error('SAB throttle tests must not touch the network')
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

function run({
  collect,
  importFeed = vi.fn(async () => {}),
  extraArgs = [] as string[],
  now,
}: {
  collect: (args: { brainrot: { name: string } }) => Promise<unknown>
  importFeed?: ReturnType<typeof vi.fn>
  extraArgs?: string[]
  now?: () => number
}) {
  const output = join(dir, 'feed.json')
  const progress = join(dir, 'progress.json')
  const githubOutput = join(dir, 'github-output')
  writeFileSync(githubOutput, '')
  const promise = main({
    argv: [
      '--send',
      '--max-brainrots', '5',
      '--refresh-after-hours', '20',
      '--output', output,
      '--progress', progress,
      ...extraArgs,
    ],
    deps: {
      buildQueue: fakeQueue(),
      collect,
      importFeed,
      client: { stats: () => ({ requests: 7, blocks: 2, transient_retries: 0, final_interval_ms: 4000 }) },
      pause: async () => {},
      ...(now ? { now } : {}),
      env: { SAB_MARKET_IMPORT_SECRET: 'test-secret', GITHUB_OUTPUT: githubOutput },
    },
  })
  const feed = () => JSON.parse(readFileSync(output, 'utf8'))
  const ghOutput = () => readFileSync(githubOutput, 'utf8')
  const progressFile = () => JSON.parse(readFileSync(progress, 'utf8'))
  return { promise, importFeed, output, feed, ghOutput, progressFile }
}

describe('SAB collector: a throttle ends the crawl cleanly (2026-10-28/29)', () => {
  it('keeps what was collected, imports it, warns, and resolves (exit 0)', async () => {
    const collect = vi.fn(async ({ brainrot }: { brainrot: { name: string } }) => {
      if (brainrot.name === 'Charlie') throw blocked()
      return result(brainrot.name)
    })
    const r = run({ collect })

    await expect(r.promise).resolves.toMatchObject({
      imported: true,
      listing_count: 2,
      stopped_early: { reason: 'eldorado_blocked', at_index: 2, targets_done: 2, targets_total: 5 },
    })

    // Stopped at the block: Delta and Echo were never requested.
    expect(collect.mock.calls.map(([a]) => a.brainrot.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])

    const feed = r.feed()
    expect(feed.stopped_early).toMatchObject({
      reason: 'eldorado_blocked',
      at_index: 2,
      targets_total: 5,
      brainrot_name: 'Charlie',
      http_status: 429,
    })
    expect(feed.listings.map((l: { external_listing_id: string }) => l.external_listing_id)).toEqual([
      'offer-Alpha',
      'offer-Bravo',
    ])
    expect(feed.target_summaries.map((s: { status: string }) => s.status)).toEqual([
      'collected',
      'collected',
      'blocked',
    ])
    expect(feed.eldorado_http).toMatchObject({ requests: 7, blocks: 2 })

    // The normal import of what was collected still runs.
    expect(r.importFeed).toHaveBeenCalledTimes(1)
    expect(r.importFeed).toHaveBeenCalledWith(r.output)

    const notice = 'Eldorado throttled the SAB crawl at 2/5; imported what was collected'
    expect(logs).toContain(`::warning::${notice}`)
    expect(r.ghOutput()).toBe(`stopped_early=${notice}\n`)

    // The blocked brainrot has no progress attempt, so backfill mode retries it.
    const attempts = r.progressFile().attempts
    expect(Object.keys(attempts).sort()).toEqual(['id-Alpha', 'id-Bravo'])
  })

  it('a block before anything was collected still fails (nothing to import)', async () => {
    const r = run({ collect: async () => Promise.reject(blocked()) })
    await expect(r.promise).rejects.toThrow(/throttled the SAB crawl at 0\/5 before any listing was collected/)
    expect(r.importFeed).not.toHaveBeenCalled()
    // The feed is still written, for the run artifact.
    expect(r.feed().stopped_early).toMatchObject({ reason: 'eldorado_blocked', targets_done: 0 })
  })

  it('an ordinary per-brainrot error is NOT a stop: the crawl carries on, no warning', async () => {
    const collect = vi.fn(async ({ brainrot }: { brainrot: { name: string } }) => {
      if (brainrot.name === 'Bravo') throw new Error('Eldorado API returned HTTP 500 for …')
      return result(brainrot.name)
    })
    const r = run({ collect })
    await expect(r.promise).resolves.toMatchObject({ imported: true, listing_count: 4, stopped_early: null })
    expect(collect).toHaveBeenCalledTimes(5)
    expect(r.feed().stopped_early).toBeNull()
    expect(logs.some((l) => l.startsWith('::warning::'))).toBe(false)
    expect(r.ghOutput()).toBe('')
  })

  it('a failed import still fails the step, early stop or not', async () => {
    const collect = async ({ brainrot }: { brainrot: { name: string } }) => {
      if (brainrot.name === 'Delta') throw blocked()
      return result(brainrot.name)
    }
    const importFeed = vi.fn(async () => {
      throw new Error('Bulk importer exited with code 1')
    })
    const r = run({ collect, importFeed })
    await expect(r.promise).rejects.toThrow(/Bulk importer exited with code 1/)
    expect(logs.some((l) => l.startsWith('::warning::'))).toBe(false)
  })

  it('the crawl budget stops the same way, so a slowed crawl never meets the job timeout', async () => {
    let clock = 0
    const collect = vi.fn(async ({ brainrot }: { brainrot: { name: string } }) => {
      clock += 31 * 60 * 1000 // each brainrot "takes" 31 min
      return result(brainrot.name)
    })
    const r = run({ collect, now: () => clock, extraArgs: ['--max-crawl-minutes', '60'] })
    await expect(r.promise).resolves.toMatchObject({
      imported: true,
      listing_count: 2,
      stopped_early: { reason: 'time_budget', at_index: 2, budget_minutes: 60 },
    })
    expect(collect).toHaveBeenCalledTimes(2)
    expect(logs).toContain(
      '::warning::The SAB crawl hit its 60-minute budget at 2/5; imported what was collected',
    )
  })

  it('--request-interval-ms is validated', async () => {
    const r = run({ collect: async () => result('x'), extraArgs: ['--request-interval-ms', '200'] })
    await expect(r.promise).rejects.toThrow(/--request-interval-ms/)
  })

  it('earlyStopNotice says dry run when nothing was imported', () => {
    expect(
      earlyStopNotice({ reason: 'eldorado_blocked', targets_done: 61, targets_total: 420 }, { imported: false }),
    ).toBe('Eldorado throttled the SAB crawl at 61/420; feed saved, nothing imported (dry run)')
  })
})

describe('collectOne never swallows a block', () => {
  const brainrot = { id: 'b1', name: 'Meowl', slug: 'meowl', rarity: 'OG' }
  const offer = (id: string) => ({
    offer: { id, offerTitle: 'Meowl', pricePerUnitInUSD: { amount: 10 } },
    user: { id: 'seller-1', createdDate: '2020-01-01T00:00:00Z' },
  })
  const args = (client: unknown) => ({
    brainrot,
    mutations: [],
    expectedIncomeByVariant: new Map(),
    samplesPerVariant: 25,
    maxPagesPerBrainrot: 10,
    observedAt: '2026-10-29T08:30:00.000Z',
    saveApi: false,
    client,
  })

  it('from a candidate query (it used to be a regex on the message)', async () => {
    const client = {
      getJson: vi.fn(async (_url: unknown, opts?: { optional?: boolean }) => {
        if (opts?.optional) return null // SEO mapping: none
        throw blocked()
      }),
    }
    await expect(collectOne(args(client))).rejects.toBeInstanceOf(EldoradoBlockedError)
    // Mapping + the first candidate only: no further requests into the block.
    expect(client.getJson).toHaveBeenCalledTimes(2)
  })

  it('from a deep offer page: the half-read brainrot is dropped, not imported', async () => {
    let call = 0
    const client = {
      getJson: vi.fn(async (_url: unknown, opts?: { optional?: boolean }) => {
        if (opts?.optional) return null
        call += 1
        if (call === 1) return { totalPages: 5, results: [offer('aaaaaaaa-0001')] }
        throw blocked()
      }),
    }
    await expect(collectOne(args(client))).rejects.toBeInstanceOf(EldoradoBlockedError)
    expect(client.getJson).toHaveBeenCalledTimes(3)
    // The third request was page 2 of the matched query, not the search fallback.
    const third = new URL(String(client.getJson.mock.calls[2][0]))
    expect(third.searchParams.get('pageIndex')).toBe('2')
    expect(third.searchParams.get('tradeEnvironmentValue2')).toBe('MEOWL')
  })
})
