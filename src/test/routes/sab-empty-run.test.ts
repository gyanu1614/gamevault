import { describe, expect, it } from 'vitest'

import { classifyEmptyRun } from '../../../scripts/collect-eldorado-sab-api-v6.mjs'

/**
 * ROUTE-017 (1). With `--refresh-after-hours 6` on a a 3-hourly schedule the
 * queue is a staleness FILTER, so a tick that finds nothing due is the filter
 * working correctly. The collector used to `throw` on exactly that outcome
 * under `--send`, so routine quiet ticks went red — and a workflow that is red
 * on healthy runs is how a genuinely broken run hides (cf. ROUTE-014's month of
 * silent staleness). There is also nothing to send in that state: the edge
 * function rejects an empty `listings` array with a 400.
 *
 * Two empty outcomes exist and they are NOT the same event:
 *   - no_eligible_targets  — the queue filtered everything out (nothing due).
 *   - no_listings_parsed   — we DID crawl targets and they yielded no offers.
 * The second is the one worth looking at; conflating them is what makes an
 * empty run uninformative.
 */
describe('classifyEmptyRun', () => {
  it('names panel-refresh staleness when the queue had nothing due', () => {
    const result = classifyEmptyRun({
      targetCount: 0,
      listingCount: 0,
      usePanelRefresh: true,
      refreshAfterHours: 6,
    })

    expect(result.reason).toBe('no_eligible_targets')
    expect(result.empty).toBe(true)
    expect(result.message).toMatch(/Nothing to do:/)
    expect(result.message).toMatch(/6h/)
  })

  it('names backfill exhaustion when the progress file has attempted everything', () => {
    const result = classifyEmptyRun({
      targetCount: 0,
      listingCount: 0,
      usePanelRefresh: false,
      refreshAfterHours: 0,
    })

    expect(result.reason).toBe('no_eligible_targets')
    expect(result.message).toMatch(/--reset-progress/)
  })

  it('distinguishes targets-that-yielded-nothing from nothing-was-due', () => {
    const result = classifyEmptyRun({
      targetCount: 210,
      listingCount: 0,
      usePanelRefresh: true,
      refreshAfterHours: 6,
    })

    expect(result.reason).toBe('no_listings_parsed')
    expect(result.empty).toBe(true)
    expect(result.message).toMatch(/210/)
    expect(result.message).toMatch(/target_summaries/)
  })

  it('is not an empty run when listings were parsed', () => {
    const result = classifyEmptyRun({
      targetCount: 210,
      listingCount: 4_312,
      usePanelRefresh: true,
      refreshAfterHours: 6,
    })

    expect(result.empty).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('treats an empty run as success — it never asks the caller to fail', () => {
    for (const targetCount of [0, 210]) {
      expect(
        classifyEmptyRun({
          targetCount,
          listingCount: 0,
          usePanelRefresh: true,
          refreshAfterHours: 6,
        }).ok,
      ).toBe(true)
    }
  })

  it('keeps the two empty reasons distinct — that is the whole point', () => {
    const noTargets = classifyEmptyRun({
      targetCount: 0,
      listingCount: 0,
      usePanelRefresh: true,
      refreshAfterHours: 6,
    })
    const noListings = classifyEmptyRun({
      targetCount: 210,
      listingCount: 0,
      usePanelRefresh: true,
      refreshAfterHours: 6,
    })

    expect(noTargets.reason).not.toBe(noListings.reason)
    expect(noTargets.message).not.toBe(noListings.message)
  })
})
