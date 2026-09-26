/**
 * planExpiries — the expire job's decision, pure.
 *
 * Extracted from /api/cron/expire-sab-listings when the job moved to the
 * runner (2026-09-20). The decision is unchanged and these cases pin it:
 * absence is evidence only inside a group whose newest crawl is recent, and
 * only for listings that crawl demonstrably missed.
 */
import { describe, expect, it } from 'vitest'

import {
  RECENT_CRAWL_HOURS,
  STALE_GRACE_HOURS,
  planExpiries,
} from '@/lib/sab/expire-listings'

const NOW = Date.parse('2026-09-20T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString()

function listing(id: string, fetchedAt: string, brainrot: string | null = 'b1', source = 's1') {
  return { id, source_id: source, brainrot_id: brainrot, fetched_at: fetchedAt }
}

describe('planExpiries', () => {
  it('ends a listing the latest crawl of its group demonstrably missed', () => {
    const plan = planExpiries([listing('new', at(1)), listing('old', at(1 + STALE_GRACE_HOURS + 8))], NOW)
    expect(plan.ids).toEqual(['old'])
    expect(plan.groupsTotal).toBe(1)
    expect(plan.groupsRecentlyCrawled).toBe(1)
    expect(plan.groupsSkippedNotRecentlyCrawled).toBe(0)
  })

  it('keeps a listing inside the within-run grace of its group\'s newest crawl', () => {
    // A crawl of one Brainrot writes fetched_at across many minutes; the last
    // listings written must not look stale relative to the first.
    const plan = planExpiries([listing('new', at(1)), listing('same-run', at(1 + STALE_GRACE_HOURS - 0.5))], NOW)
    expect(plan.ids).toEqual([])
  })

  it('concludes nothing from a group nobody has looked at recently', () => {
    // If collection stopped, "not seen" means "we did not look", not "sold".
    const stale = at(RECENT_CRAWL_HOURS + 1)
    const older = at(RECENT_CRAWL_HOURS + 100)
    const plan = planExpiries([listing('a', stale), listing('b', older)], NOW)
    expect(plan.ids).toEqual([])
    expect(plan.groupsSkippedNotRecentlyCrawled).toBe(1)
    expect(plan.groupsRecentlyCrawled).toBe(0)
  })

  it('ignores unmatched listings — no group, no conclusion', () => {
    const plan = planExpiries([listing('u', at(50), null)], NOW)
    expect(plan.ids).toEqual([])
    expect(plan.groupsTotal).toBe(0)
  })

  it('groups by (source, brainrot): one source\'s fresh crawl says nothing about another\'s', () => {
    const plan = planExpiries(
      [listing('eld-new', at(1), 'b1', 'eldorado'), listing('g2g-old', at(40), 'b1', 'g2g')],
      NOW,
    )
    expect(plan.ids).toEqual([])
    expect(plan.groupsTotal).toBe(2)
    expect(plan.groupsSkippedNotRecentlyCrawled).toBe(1)
  })

  it('ignores a listing with an unparseable fetched_at rather than ending it', () => {
    const plan = planExpiries([listing('new', at(1)), listing('garbage', 'not-a-date')], NOW)
    expect(plan.ids).toEqual([])
  })
})
