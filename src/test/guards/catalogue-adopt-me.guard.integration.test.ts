/**
 * Catalogue pipeline, Adopt Me, against the local stack: a new pet and its 8
 * empty forms, insert-only (an existing pet is never rewritten), and the image
 * retry reading the wiki by name, then "Name (Pet)". Rows use this file's
 * fixture namespace; forms go with their pet (ON DELETE CASCADE).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { adoptMe, PET_VARIANTS } from '@/lib/catalogue/games/adopt-me'
import type { ParsedItem, WikiClient } from '@/lib/catalogue/types'

const ns = fixtureNamespace()
const slug = (s: string) => `guard-test-${ns.tag}-${s}`
const LIKE = `guard-test-${ns.key}%`
let svc: SupabaseClient

const pet = (s: string, over: Partial<ParsedItem> = {}): ParsedItem => ({
  pageId: 970_000 + s.length,
  revisionId: 1,
  wikiTitle: slug(s),
  pageUrl: 'https://adoptme.fandom.com/wiki/X',
  slug: slug(s),
  name: slug(s),
  rarity: 'uncommon',
  imageFile: 'X.png',
  releasedAt: '2026-10-16',
  origin: 'Basic Egg',
  howToGet: { status: 'obtainable', method: 'Hatched from the Basic Egg in the Nursery.', sources: ['https://x'], confidence: 'medium', checked_at: '2026-10-22' },
  ...over,
  extra: { obtainability: 'limited', originType: 'egg' },
})
const images = { copy: async (file: string) => file === 'X.png' }

describe.skipIf(!hasEnv)('catalogue pipeline: Adopt Me adapter (guard)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
  })
  afterAll(async () => {
    await svc.from('adopt_me_pets').delete().like('slug', LIKE)
    const left = await svc.from('adopt_me_pets').select('slug').like('slug', LIKE)
    expect(left.data).toEqual([])
  })

  it('adds a pet with its 8 empty forms and never rewrites an existing pet', async () => {
    expect(await adoptMe.insert(svc, [pet('shoe')], images)).toEqual([slug('shoe')])
    expect(await adoptMe.insert(svc, [pet('shoe', { rarity: 'legendary' })], images)).toEqual([])
    const { data } = await svc
      .from('adopt_me_pets')
      .select('id,rarity,obtainability,origin_type,origin_detail,released_at,is_active,image_url,how_to_get,has_page')
      .eq('slug', slug('shoe'))
      .single()
    expect(data).toMatchObject({ rarity: 'uncommon', obtainability: 'limited', origin_type: 'egg', origin_detail: 'Basic Egg', released_at: '2026-10-16', is_active: true, has_page: false })
    expect(data?.image_url).toMatch(new RegExp(`/storage/v1/object/public/adopt-me-pets/wiki/${slug('shoe')}\\.webp$`))
    const forms = await svc.from('adopt_me_pet_values').select('variant,trade_value,cash_value_usd,listings_tracked').eq('pet_id', data?.id)
    expect((forms.data ?? []).map((f) => f.variant).sort()).toEqual([...PET_VARIANTS].sort())
    expect(forms.data?.every((f) => f.trade_value === null && f.cash_value_usd === null && f.listings_tracked === 0)).toBe(true)
  })

  it('fills a missing picture from the wiki page "Name (Pet)"', async () => {
    expect(await adoptMe.insert(svc, [pet('nopic', { imageFile: null })], images)).toEqual([slug('nopic')])
    const wiki = {
      wikitext: async (title: string) => (title.endsWith('(Pet)') ? '{{Pets|image = X.png|rarity = Uncommon}}' : ''),
    } as unknown as WikiClient
    expect(await adoptMe.fixMissingImages!(svc, images, wiki)).toContain(slug('nopic'))
    const { data } = await svc.from('adopt_me_pets').select('image_url').eq('slug', slug('nopic')).single()
    expect(data?.image_url).toMatch(/\.webp$/)
  })
})
