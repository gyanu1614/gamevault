/**
 * /browse reads only the columns its cards render (2026-10-20 usage audit, A7):
 * it used `listings.*` with the seller, game and category rows joined WHOLE
 * (the games row alone carries the hero srcset JSON and a base64 blur), and
 * every game and category row (disabled ones included) for two dropdowns.
 *
 * The select strings run here against the REAL PostgREST of the local stack
 * as anon, so a column that does not exist (or anon cannot read) fails this
 * test instead of blanking /browse in production.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { BROWSE_LISTING_SELECT, BROWSE_GAME_SELECT, BROWSE_CATEGORY_SELECT } from './listings-query'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)

describe('browse selects are narrow', () => {
  it('no select reads every column', () => {
    for (const s of [BROWSE_LISTING_SELECT, BROWSE_GAME_SELECT, BROWSE_CATEGORY_SELECT]) {
      expect(s).not.toMatch(/(^|[,(\s])\*/)
    }
  })
})

describe.skipIf(!LOCAL || !ANON)('browse selects against the local PostgREST (anon)', () => {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })

  it('the listing card select is valid', async () => {
    const { error } = await anon.from('listings').select(BROWSE_LISTING_SELECT).eq('status', 'active').eq('seller.is_test', false).limit(1)
    expect(error).toBeNull()
  })

  it('the game and category dropdown selects are valid', async () => {
    expect((await anon.from('games').select(BROWSE_GAME_SELECT).limit(1)).error).toBeNull()
    expect((await anon.from('game_categories').select(BROWSE_CATEGORY_SELECT).limit(1)).error).toBeNull()
  })
})
