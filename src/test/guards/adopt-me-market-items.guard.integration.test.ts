/**
 * Adopt Me eggs and potions, against the local stack: the public can read them
 * (the market catalogue uses the anon key), an inactive pet stays hidden, and
 * the catalogue hands them over with their kind and no rarity. If the policy ever
 * narrows back to is_active, every egg page 404s with no error anywhere.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC, ANON } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { loadValueCatalog } from '@/lib/value-listings/catalogs'

const ns = fixtureNamespace()
const slug = (s: string) => `guard-test-${ns.tag}-${s}`
const LIKE = `guard-test-${ns.key}%`
let svc: SupabaseClient
let anon: SupabaseClient

describe.skipIf(!hasEnv)('Adopt Me eggs and potions: who can read them (guard)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } })
    const { error } = await svc.from('adopt_me_pets').insert([
      { slug: slug('egg'), name: `${slug('egg')} Egg`, rarity: 'common', is_active: false, item_kind: 'egg' },
      { slug: slug('retired'), name: slug('retired'), rarity: 'rare', is_active: false },
    ])
    expect(error).toBeNull()
  })
  afterAll(async () => {
    await svc.from('adopt_me_pets').delete().like('slug', LIKE)
    const left = await svc.from('adopt_me_pets').select('slug').like('slug', LIKE)
    expect(left.data).toEqual([])
  })

  it('the anon key reads an egg but not an inactive pet', async () => {
    const { data, error } = await anon.from('adopt_me_pets').select('slug').like('slug', LIKE)
    expect(error).toBeNull()
    expect(data?.map((r) => r.slug)).toEqual([slug('egg')])
  })

  it('the anon catalogue carries its kind and drops the placeholder rarity', async () => {
    const loaded = await loadValueCatalog(anon as never, { id: 'unused', slug: 'adopt-me' })
    const egg = loaded?.items.find((i) => i.slug === slug('egg'))
    expect(egg).toMatchObject({ kind: 'egg', rarity: null, hasPage: false })
    expect(loaded?.items.some((i) => i.slug === slug('retired'))).toBe(false)
  })

  it('the column refuses anything but egg or potion', async () => {
    const { error } = await svc.from('adopt_me_pets').insert({ slug: slug('bad'), name: slug('bad'), rarity: 'common', item_kind: 'pet' })
    expect(error).not.toBeNull()
  })
})
