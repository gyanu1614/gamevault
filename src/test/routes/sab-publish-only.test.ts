import { describe, expect, it } from 'vitest'

import {
  buildBatchPlan,
  parseArgs,
} from '../../../scripts/import-sab-market-json.mjs'

/**
 * ROUTE-017 (2). The importer's publish step (publish:true →
 * sab_publish_market_estimates → sab_refresh_evidence_display →
 * sab_refresh_price_display) is seconds of work at the tail of a 30-40 minute
 * scrape, and it is the most failure-prone call in the whole pipeline: it is
 * what trips the statement timeout (ROUTE-011) and what tripped the safe-update
 * guard (ROUTE-013). Recovering from a failed publish meant re-scraping
 * Eldorado for rows already sitting in sab_market_raw_listings.
 *
 * --publish-only re-sends ONLY the final batch with publish:true. The upsert is
 * idempotent on (source, external_listing_id), so re-sending rows already
 * imported is a no-op that costs one request; and the batch is non-empty, which
 * matters because the edge function rejects an empty `listings` array with 400.
 */

const listings = (n: number, source = 'eldorado') =>
  Array.from({ length: n }, (_, i) => ({
    source_slug: source,
    external_listing_id: `${source}-${i}`,
  }))

const groups = (entries: Array<[string, unknown[]]>) => new Map(entries)

describe('buildBatchPlan — normal --send', () => {
  it('chunks at 500 and publishes on the last batch only', () => {
    const plan = buildBatchPlan(groups([['eldorado', listings(1_200)]]), {
      publishOnly: false,
    })

    expect(plan.map((p) => p.batch.length)).toEqual([500, 500, 200])
    expect(plan.map((p) => p.publish)).toEqual([false, false, true])
  })

  it('publishes exactly once across multiple sources', () => {
    const plan = buildBatchPlan(
      groups([
        ['eldorado', listings(600, 'eldorado')],
        ['g2g', listings(300, 'g2g')],
      ]),
      { publishOnly: false },
    )

    expect(plan.filter((p) => p.publish)).toHaveLength(1)
    expect(plan.at(-1)?.publish).toBe(true)
    expect(plan.at(-1)?.sourceSlug).toBe('g2g')
  })

  it('publishes on the sole batch of a small feed', () => {
    const plan = buildBatchPlan(groups([['eldorado', listings(12)]]), {
      publishOnly: false,
    })

    expect(plan).toHaveLength(1)
    expect(plan[0].publish).toBe(true)
  })
})

describe('buildBatchPlan — --publish-only', () => {
  it('keeps only the final batch, and publishes it', () => {
    const plan = buildBatchPlan(groups([['eldorado', listings(1_200)]]), {
      publishOnly: true,
    })

    expect(plan).toHaveLength(1)
    expect(plan[0].publish).toBe(true)
    expect(plan[0].batch).toHaveLength(200)
  })

  it('sends the SAME final batch --send would have published on', () => {
    const feed = groups([
      ['eldorado', listings(600, 'eldorado')],
      ['g2g', listings(300, 'g2g')],
    ])

    const full = buildBatchPlan(feed, { publishOnly: false })
    const only = buildBatchPlan(feed, { publishOnly: true })

    expect(only).toHaveLength(1)
    expect(only[0].sourceSlug).toBe(full.at(-1)?.sourceSlug)
    expect(only[0].batch).toEqual(full.at(-1)?.batch)
  })

  it('never sends an empty batch — the edge function 400s on one', () => {
    for (const n of [1, 12, 500, 501, 1_000, 1_200]) {
      const plan = buildBatchPlan(groups([['eldorado', listings(n)]]), {
        publishOnly: true,
      })
      expect(plan).toHaveLength(1)
      expect(plan[0].batch.length).toBeGreaterThan(0)
    }
  })

  it('is a no-op plan for an empty feed rather than an empty publish', () => {
    expect(buildBatchPlan(groups([]), { publishOnly: true })).toEqual([])
    expect(
      buildBatchPlan(groups([['eldorado', []]]), { publishOnly: true }),
    ).toEqual([])
  })

  it('labels the batch so the log says it was publish-only', () => {
    const plan = buildBatchPlan(groups([['eldorado', listings(1_200)]]), {
      publishOnly: true,
    })

    expect(plan[0].label).toMatch(/publish-only/i)
  })
})

describe('parseArgs — --publish-only implies --send', () => {
  it('sets send when --publish-only is passed alone', () => {
    const args = parseArgs(['feed.json', '--publish-only'])

    expect(args.publishOnly).toBe(true)
    expect(args.send).toBe(true)
  })

  it('defaults publishOnly to false', () => {
    expect(parseArgs(['feed.json']).publishOnly).toBe(false)
    expect(parseArgs(['feed.json', '--send']).publishOnly).toBe(false)
  })

  it('accepts --publish-only alongside an explicit --send', () => {
    const args = parseArgs(['feed.json', '--send', '--publish-only'])

    expect(args.publishOnly).toBe(true)
    expect(args.send).toBe(true)
  })

  it('still requires a feed path', () => {
    expect(() => parseArgs(['--publish-only'])).toThrow(/required/i)
  })
})
