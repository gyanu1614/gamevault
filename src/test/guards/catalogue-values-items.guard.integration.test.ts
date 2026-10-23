/**
 * Catalogue pipeline, generic values_items games, against the local stack:
 * the MM2 and Steal an Egg adapters' insert-only writes, chroma → base links,
 * appended sort order, egg links, and the image retry. Rows use this file's
 * fixture namespace (guard-test-<key>…) inside the real seeded games and are
 * all removed in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { murderMystery2 } from '@/lib/catalogue/games/murder-mystery-2'
import { stealAnEgg } from '@/lib/catalogue/games/steal-an-egg'
import { gameIdBySlug, loadValuesKnown, nextSortOrder } from '@/lib/catalogue/games/values-items'
import type { ParsedItem, WikiClient } from '@/lib/catalogue/types'

const ns = fixtureNamespace()
const slug = (s: string) => `guard-test-${ns.tag}-${s}`
const LIKE = `guard-test-${ns.key}%`
let svc: SupabaseClient
let mm2Id = ''
let saeId = ''

const mm2Item = (s: string, over: Partial<ParsedItem> = {}, extra: Record<string, unknown> = {}): ParsedItem => ({
  pageId: 980_000 + s.length,
  revisionId: 1,
  wikiTitle: slug(s),
  pageUrl: `https://murder-mystery-2.fandom.com/wiki/${slug(s)}`,
  slug: slug(s),
  name: slug(s),
  rarity: 'Godly',
  imageFile: 'X.png',
  releasedAt: null,
  origin: '2026 Halloween Box',
  howToGet: { status: 'seasonal', method: 'Unboxed from the 2026 Halloween Box.', sources: ['https://x'], confidence: 'medium', checked_at: '2026-10-22' },
  ...over,
  extra: { itemType: 'knife', isChroma: false, baseTitle: null, displayTitle: null, releaseYear: 2026, obtain: [], ...extra },
})
const images = { copy: async (file: string) => file === 'X.png' }

describe.skipIf(!hasEnv)('catalogue pipeline: values_items adapters (guard)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    mm2Id = await gameIdBySlug(svc, 'murder-mystery-2')
    saeId = await gameIdBySlug(svc, 'steal-an-egg')
  })
  afterAll(async () => {
    await svc.from('values_items').delete().like('slug', LIKE)
    const left = await svc.from('values_items').select('slug').like('slug', LIKE)
    expect(left.data).toEqual([])
  })

  it('MM2: inserts new items after the last sort order, never rewrites, links a Chroma to its base', async () => {
    const start = await nextSortOrder(svc, mm2Id)
    const base = mm2Item('ember')
    const chroma = mm2Item('chroma', { rarity: 'Chroma', name: `Chroma ${slug('ember')}`, slug: slug('chroma') }, { isChroma: true, baseTitle: slug('ember') })
    expect(await murderMystery2.insert(svc, [base, chroma], images)).toEqual([slug('ember'), slug('chroma')])
    expect(await murderMystery2.insert(svc, [{ ...base, rarity: 'Ancient' }], images)).toEqual([])
    const { data } = await svc
      .from('values_items')
      .select('id,slug,rarity,item_type,kind,is_priced,sort_order,base_item_id,image_url,image_attribution,how_to_get,release_year,origin,wiki_title')
      .like('slug', LIKE)
      .order('sort_order')
    const [b, c] = data ?? []
    expect(b).toMatchObject({ slug: slug('ember'), rarity: 'Godly', item_type: 'knife', kind: 'item', is_priced: true, sort_order: start, release_year: 2026, origin: '2026 Halloween Box' })
    expect(b.image_url).toMatch(new RegExp(`/storage/v1/object/public/values-items/murder-mystery-2/${slug('ember')}\\.webp$`))
    expect(b.image_attribution).toMatch(/^Image: Murder Mystery 2 Wiki \(Fandom\), CC-BY-SA 3\.0 — https:\/\/murder-mystery-2\.fandom\.com\/wiki\/File:X\.png$/)
    expect(b.how_to_get).toMatchObject({ status: 'seasonal' })
    expect(c).toMatchObject({ slug: slug('chroma'), sort_order: start + 1, base_item_id: b.id })
    const known = await loadValuesKnown(svc, mm2Id)
    expect(known.find((k) => k.slug === slug('ember'))).toEqual({ slug: slug('ember'), name: slug('ember'), pageId: null })
  })

  it('MM2: an item inserted without a picture gets one on the retry, read from its wiki page', async () => {
    expect(await murderMystery2.insert(svc, [mm2Item('nopic', { imageFile: null })], images)).toEqual([slug('nopic')])
    const wiki = { wikitext: async () => '{{Infobox Item|image=[[File:X.png]]|type=Knife}}' } as unknown as WikiClient
    const fixed = await murderMystery2.fixMissingImages!(svc, images, wiki)
    expect(fixed).toContain(slug('nopic'))
    const { data } = await svc.from('values_items').select('image_url').eq('slug', slug('nopic')).single()
    expect(data?.image_url).toMatch(/\.webp$/)
  })

  it('Steal an Egg: inserts catalogue-only pets and links an existing egg, never creating one', async () => {
    const egg = await svc.from('values_items').insert({ game_id: saeId, kind: 'egg', slug: slug('egg'), name: `Guard ${ns.tag} Egg`, is_priced: true, sort_order: 0 }).select('id').single()
    const pet: ParsedItem = {
      ...mm2Item('pet', { rarity: 'Divine', imageFile: null, howToGet: null, origin: 'Snow' }),
      extra: { area: 'Snow', income: 12_500_000_000, eggName: `Guard ${ns.tag}` },
    }
    const orphan: ParsedItem = { ...pet, slug: slug('orphan'), name: slug('orphan'), extra: { area: null, income: null, eggName: 'VOIDSEER' } }
    expect(await stealAnEgg.insert(svc, [pet, orphan], images)).toEqual([slug('pet'), slug('orphan')])
    const { data } = await svc.from('values_items').select('slug,kind,is_priced,rarity,area,income_per_sec,source_item_id').in('slug', [slug('pet'), slug('orphan')]).order('slug')
    expect(data).toEqual([
      { slug: slug('orphan'), kind: 'pet', is_priced: false, rarity: 'Divine', area: null, income_per_sec: null, source_item_id: null },
      { slug: slug('pet'), kind: 'pet', is_priced: false, rarity: 'Divine', area: 'Snow', income_per_sec: 12_500_000_000, source_item_id: egg.data?.id },
    ])
    const eggs = await svc.from('values_items').select('slug').eq('game_id', saeId).eq('kind', 'egg').ilike('name', '%voidseer%')
    expect(eggs.data).toEqual([])
  })
})
