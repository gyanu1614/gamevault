/**
 * Buy rails switches (growth point 2, migration 20261012210300): the
 * buy_rail_settings row is readable by the public pages (anon) and by signed-in
 * users, writable by nobody but the service role (the /admin/buy-rails action).
 *
 * The test flips one switch with the service role and puts it back; it creates
 * no other rows except the throwaway fixture users, which cleanup() removes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ANON, SVC, URL, assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'

const COLS = 'blog, value_item, value_list, calculator'

let svc: SupabaseClient
let anon: SupabaseClient
let fx: Fixture

describe.skipIf(!hasEnv)('buy_rail_settings posture (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    fx = await makeFixture()
  }, 120_000)

  afterAll(async () => {
    // Every switch back on (the migration's default), then the fixture users.
    await svc.from('buy_rail_settings').update({ blog: true, value_item: true, value_list: true, calculator: true }).eq('id', 1)
    await fx?.cleanup()
  }, 120_000)

  it('the migration seeds one row, every surface on', async () => {
    const { data, error } = await svc.from('buy_rail_settings').select(`id, ${COLS}`)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: 1, blog: true, value_item: true, value_list: true, calculator: true }])
  })

  it('anon (the public pages) can read the four switches', async () => {
    const { data, error } = await anon.from('buy_rail_settings').select(COLS).eq('id', 1).maybeSingle()
    expect(error).toBeNull()
    expect(data).toEqual({ blog: true, value_item: true, value_list: true, calculator: true })
  })

  it('anon cannot read who changed it', async () => {
    const { error } = await anon.from('buy_rail_settings').select('updated_by').eq('id', 1)
    expect(error).not.toBeNull()
  })

  it('anon cannot change a switch', async () => {
    await anon.from('buy_rail_settings').update({ blog: false }).eq('id', 1)
    const { data } = await svc.from('buy_rail_settings').select('blog').eq('id', 1).single()
    expect((data as { blog: boolean }).blog).toBe(true)
  })

  it('a signed-in user (even the fixture admin) cannot change a switch with their session', async () => {
    for (const actor of [fx.buyer, fx.seller, fx.admin]) {
      await actor.client.from('buy_rail_settings').update({ value_item: false }).eq('id', 1)
      await actor.client.from('buy_rail_settings').insert({ id: 2, blog: false })
    }
    const { data } = await svc.from('buy_rail_settings').select(`id, ${COLS}`)
    expect(data).toEqual([{ id: 1, blog: true, value_item: true, value_list: true, calculator: true }])
  })

  it('the service role (the admin action) can switch a surface off, and the public read sees it', async () => {
    const { error } = await svc.from('buy_rail_settings').update({ calculator: false }).eq('id', 1)
    expect(error).toBeNull()
    const { data } = await anon.from('buy_rail_settings').select('calculator').eq('id', 1).single()
    expect((data as { calculator: boolean }).calculator).toBe(false)
  })

  it('there is only ever one row', async () => {
    const { error } = await svc.from('buy_rail_settings').insert({ id: 2 })
    expect(error).not.toBeNull()
  })
})
