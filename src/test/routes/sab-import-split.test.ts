import { describe, it, expect, vi } from 'vitest'
import { sendSplitting } from '../../../scripts/import-sab-market-json.mjs'

/**
 * Values Pricing Daily, Oct 7 + Oct 9: batch 53/54 (500 listings) timed out
 * (504 / 546 / lock timeout) on every retry — the gateway gave up while the
 * insert kept running and holding its locks — and the whole SAB import died,
 * so the reprice never ran. A batch that still fails after its retries is
 * split in half and sent again, down to small pieces; a piece that still
 * fails is skipped and reported instead of costing the whole day.
 */
const listing = (id: string) => ({ external_listing_id: id })
const timeout = () => Object.assign(new Error('eldorado import failed: HTTP 504'), { status: 504 })

describe('SAB import: split a failing batch', () => {
  it('splits until the slow part is isolated, sends everything else, reports the rest', async () => {
    const batch = Array.from({ length: 100 }, (_, i) => listing(`o${i}`))
    const sent: string[] = []
    const send = vi.fn(async (part: ReturnType<typeof listing>[]) => {
      if (part.some((l) => l.external_listing_id === 'o42')) throw timeout()
      sent.push(...part.map((l) => l.external_listing_id))
      return { result: { records_seen: part.length } }
    })
    const out = await sendSplitting(batch, send, { label: 'eldorado batch 53', minSize: 25, pauseMs: 0 })
    expect(sent).toHaveLength(75)
    expect(sent).not.toContain('o42')
    expect(out.skipped).toHaveLength(1)
    expect(out.skipped[0].ids).toContain('o42')
    expect(out.skipped[0].ids).toHaveLength(25)
  })

  it('a batch that works is sent once, unsplit', async () => {
    const send = vi.fn(async () => ({ result: {} }))
    const out = await sendSplitting([listing('a'), listing('b')], send, { label: 'b1', pauseMs: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(out.skipped).toEqual([])
  })

  it('a non-transient error still stops the import (bad data must not be skipped quietly)', async () => {
    const send = vi.fn(async () => { throw Object.assign(new Error('eldorado import failed: HTTP 400'), { status: 400 }) })
    await expect(sendSplitting([listing('a'), listing('b')], send, { label: 'b1', pauseMs: 0 })).rejects.toThrow('HTTP 400')
  })
})
