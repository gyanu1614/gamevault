/**
 * The stale-COUNT half of the freshness guard.
 *
 * ROUTE-014 checks max(price_updated_at) per table. That is blind to a PARTIAL
 * freeze, and a partial freeze is what actually happened: from 2026-09-14 the
 * correction 504'd every run, yet ~173 of 393 brainrots kept repricing through
 * another path, so max() was always minutes old and the guard stayed green for
 * five days while 214 brainrots served Sep 14 prices behind a confident
 * "Updated" badge.
 *
 * max() answers "did ANY row move?". These tests pin the question that would
 * have caught it: "did any row NOT move?"
 */
import { describe, it, expect } from 'vitest'

import { evaluateStaleCount } from '@/app/api/cron/check-sab-freshness/freshness-checks'

const CHECK = {
  table: 'sab_price_display',
  column: 'price_updated_at',
  maxStaleRows: 0,
  stalenessHours: 6,
}

describe('evaluateStaleCount', () => {
  it('passes when no row is older than the window', () => {
    const result = evaluateStaleCount(CHECK, 0)
    expect(result.stale).toBe(false)
    expect(result.staleRows).toBe(0)
  })

  it('FAILS on the real outage shape: fresh max, 214 frozen rows', () => {
    // The exact case the max() check missed for five days.
    const result = evaluateStaleCount(CHECK, 214)
    expect(result.stale).toBe(true)
    expect(result.staleRows).toBe(214)
  })

  it('treats a failed count read as stale, never as a pass', () => {
    // Absence of a signal is not a clean bill of health — same principle the
    // max() check already applies to an empty table.
    const result = evaluateStaleCount(CHECK, null, 'statement timeout')
    expect(result.stale).toBe(true)
    expect(result.error).toContain('statement timeout')
  })

  it('tolerates a configured number of laggards', () => {
    // A game may legitimately carry a few unpriced items (no listings at all);
    // the threshold keeps those from crying wolf.
    const tolerant = { ...CHECK, maxStaleRows: 25 }
    expect(evaluateStaleCount(tolerant, 25).stale).toBe(false)
    expect(evaluateStaleCount(tolerant, 26).stale).toBe(true)
  })
})
