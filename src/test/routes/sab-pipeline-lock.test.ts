/**
 * withPipelineLock — the client side of sab_pipeline_lock_*.
 *
 * What a caller needs: acquire or wait a bounded time, then either run with
 * the lock and ALWAYS release it, or fail with a line that names who holds it
 * and since when. These tests drive it with a fake RPC client and an injected
 * clock, so the wait/poll logic is exercised without a database or real time.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  PipelineLockHeldError,
  withPipelineLock,
} from '@/lib/pricing/pipeline-lock'

type LockRow = { holder: string; acquired_at: string; expires_at: string }

/** A fake of the two RPCs over one in-memory lock row with a fake clock. */
function fakeLock(initial: LockRow | null = null) {
  let row = initial
  let now = Date.parse('2026-09-20T20:00:00.000Z')
  const calls: string[] = []
  const client = {
    rpc: async (name: string, args: any) => {
      calls.push(name)
      if (name === 'sab_pipeline_lock_acquire') {
        const canTake = !row || Date.parse(row.expires_at) < now || row.holder === args.p_holder
        if (canTake) {
          row = {
            holder: args.p_holder,
            acquired_at: new Date(now).toISOString(),
            expires_at: new Date(now + args.p_ttl_seconds * 1000).toISOString(),
          }
          return { data: [{ acquired: true, ...row }], error: null }
        }
        return { data: [{ acquired: false, ...row }], error: null }
      }
      if (name === 'sab_pipeline_lock_release') {
        const released = !!row && row.holder === args.p_holder
        if (released) row = null
        return { data: released, error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
  }
  return {
    client,
    calls,
    get row() {
      return row
    },
    release(holder: string) {
      if (row?.holder === holder) row = null
    },
    clock: { now: () => now, advance: (ms: number) => void (now += ms) },
  }
}

const opts = (over: Record<string, unknown> = {}) => ({
  name: 'sab-pipeline',
  holder: 'reprice:test:1',
  ttlSeconds: 600,
  waitSeconds: 60,
  pollSeconds: 10,
  log: () => {},
  ...over,
})

describe('withPipelineLock', () => {
  it('acquires a free lock, runs, and releases it', async () => {
    const lock = fakeLock()
    const sleep = vi.fn(async () => {})

    const result = await withPipelineLock(
      lock.client,
      opts({ sleep, now: lock.clock.now }),
      async () => 'done',
    )

    expect(result).toBe('done')
    expect(lock.row).toBeNull()
    expect(sleep).not.toHaveBeenCalled()
    expect(lock.calls).toEqual(['sab_pipeline_lock_acquire', 'sab_pipeline_lock_release'])
  })

  it('releases the lock even when the work throws', async () => {
    const lock = fakeLock()

    await expect(
      withPipelineLock(lock.client, opts({ now: lock.clock.now }), async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(lock.row).toBeNull()
  })

  it('waits for a held lock and proceeds once it is released', async () => {
    const lock = fakeLock({
      holder: 'crawl:gh:42',
      acquired_at: '2026-09-20T19:55:00.000Z',
      expires_at: '2026-09-20T21:00:00.000Z',
    })
    // Each poll sleep advances the fake clock; the crawl lets go on the 2nd.
    let polls = 0
    const sleep = async (ms: number) => {
      lock.clock.advance(ms)
      polls += 1
      if (polls === 2) lock.release('crawl:gh:42')
    }
    const log = vi.fn()

    const result = await withPipelineLock(
      lock.client,
      opts({ sleep, now: lock.clock.now, log }),
      async () => 'ran',
    )

    expect(result).toBe('ran')
    expect(polls).toBe(2)
    // The wait is visible, and names who we waited for.
    expect(log.mock.calls.flat().join('\n')).toMatch(/held by crawl:gh:42/)
  })

  it('fails loudly, naming the holder and since when, once the wait is exhausted', async () => {
    const lock = fakeLock({
      holder: 'reprice:owner-mac:9981',
      acquired_at: '2026-09-20T19:55:00.000Z',
      expires_at: '2026-09-20T21:00:00.000Z',
    })
    const sleep = async (ms: number) => lock.clock.advance(ms)
    const work = vi.fn(async () => 'never')

    const attempt = withPipelineLock(
      lock.client,
      opts({ sleep, now: lock.clock.now }),
      work,
    )

    await expect(attempt).rejects.toBeInstanceOf(PipelineLockHeldError)
    await expect(attempt).rejects.toThrow(/held by reprice:owner-mac:9981 since 2026-09-20T19:55:00\.000Z/)
    expect(work).not.toHaveBeenCalled()
    // We never held it, so we must not release someone else's lock.
    expect(lock.row?.holder).toBe('reprice:owner-mac:9981')
  })

  it('takes over a lock whose holder died (TTL expired) instead of waiting for a ghost', async () => {
    const lock = fakeLock({
      holder: 'crawl:gh:41',
      acquired_at: '2026-09-20T18:00:00.000Z',
      expires_at: '2026-09-20T19:30:00.000Z', // already past the fake now (20:00)
    })
    const sleep = vi.fn(async () => {})

    await withPipelineLock(lock.client, opts({ sleep, now: lock.clock.now }), async () => 'ok')

    expect(sleep).not.toHaveBeenCalled()
    expect(lock.row).toBeNull()
  })

  it('surfaces an RPC error rather than treating it as "acquired"', async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: 'function sab_pipeline_lock_acquire does not exist' } }),
    }
    const work = vi.fn()

    await expect(withPipelineLock(client, opts(), work)).rejects.toThrow(/does not exist/)
    expect(work).not.toHaveBeenCalled()
  })
})
