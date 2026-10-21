/**
 * selectAllByKey against the REAL PostgREST of this worktree's local stack:
 * proves the keyset filters it emits (`gt`, and the composite `or(...)`) are
 * valid PostgREST syntax and return every row exactly once. Read-only, on
 * seeded tables (games, game_categories), so nothing needs cleaning up.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { selectAllByKey } from './select-all-by-key'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)

describe.skipIf(!LOCAL || !KEY)('selectAllByKey on the local stack', () => {
  const db = createClient(URL, KEY, { auth: { persistSession: false } })

  it('single key: every games row once, across many small pages', async () => {
    const { data: all, error } = await db.from('games').select('id')
    expect(error).toBeNull()
    const rows = await selectAllByKey<{ id: string }>(db, { table: 'games', columns: 'id', key: 'id', pageSize: 17 })
    expect(rows.length).toBe(all!.length)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })

  it('composite key: every game_categories row once, ties on the first column included', async () => {
    const { data: all, error } = await db.from('game_categories').select('game_id,slug')
    expect(error).toBeNull()
    expect(all!.length).toBeGreaterThan(100)
    const rows = await selectAllByKey<{ game_id: string; slug: string }>(db, {
      table: 'game_categories',
      columns: 'game_id,slug',
      key: ['game_id', 'slug'],
      pageSize: 7,
    })
    const seen = new Set(rows.map((r) => `${r.game_id}/${r.slug}`))
    expect(rows.length).toBe(all!.length)
    expect(seen.size).toBe(rows.length)
  })

  it('a filter is applied on every page', async () => {
    const { data: active } = await db.from('games').select('id').eq('is_active', true)
    const rows = await selectAllByKey<{ id: string }>(db, {
      table: 'games',
      columns: 'id',
      key: 'id',
      pageSize: 20,
      filter: (q) => q.eq('is_active', true),
    })
    expect(rows.length).toBe(active!.length)
  })
})
