/**
 * Sell-form sync against the local stack (spec:
 * docs/superpowers/specs/2026-10-29-sell-form-catalogue-sync-design.md):
 *  - a hand-made form (Item Type + per-type rarity + per-rarity name lists) is
 *    turned into the catalogue chain, and its listing moves onto the chain;
 *  - a second run writes nothing (the writes really land as planned);
 *  - a field and a rule the admin deleted come back with the same slug, and
 *    the listing still answers it;
 *  - an option the admin added by hand is kept, then adopted (no duplicate)
 *    once the catalogue has the item;
 *  - an option a listing still uses is never deleted.
 * A throwaway game per run; its listings are deleted, then the game cascades.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'
import { syncSellForm, type SyncDeps } from '@/lib/catalogue/sell-form/run'
import { MANAGED_KEY_MESSAGE } from '@/lib/catalogue/sell-form/managed'
import type { SellFormConfig } from '@/lib/catalogue/sell-form/types'

// The builder test below: the admin check and next/cache are mocked (no Next runtime in vitest).
vi.mock('@/lib/actions/admin-permissions', () => {
  const requireAdmin = async () => ({ userId: 'guard-admin', email: 'guard@example.com', role: 'super_admin', permissions: [] })
  return { requireAdmin, requireRole: requireAdmin }
})
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))

let fx: Fixture
let svc: SupabaseClient
let gameId = ''
let gcId = ''
let config: SellFormConfig
const listingIds: string[] = []
const repaired: string[][] = []
let formChanges = 0

/** Listing id → the item the title re-link would find (stands in for linkListingsToValueItems). */
const titleLinks = new Map<string, string>()
const deps = (): SyncDeps => ({
  db: svc,
  afterRepairs: async (ids) => {
    repaired.push(ids)
    for (const id of ids) {
      const slug = titleLinks.get(id)
      if (slug) await svc.from('listings').update({ value_item_slug: slug, value_matched_at: new Date().toISOString() }).eq('id', id)
    }
  },
  afterFormChange: async () => void formChanges++,
})
const run = (write = true) => syncSellForm(config, deps(), { write, allowLarge: true })

async function must<T>(label: string, p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${label}: ${error.message}`)
  return data as T
}
const field = async (slug: string) =>
  must<any>(`field ${slug}`, svc.from('attributes').select('id,slug,facet_indexed').eq('template_id', templateId).eq('slug', slug).maybeSingle())
const optionValues = async (slug: string) => {
  const f = await field(slug)
  if (!f) return null
  const rows = await must<any[]>('options', svc.from('attribute_options').select('value,sort_order').eq('attribute_id', f.id).order('sort_order'))
  return rows.map((r) => r.value)
}
const ruleOf = async (slug: string) => {
  const f = await field(slug)
  const rules = await must<any[]>('rules', svc.from('attribute_conditional_rules').select('trigger_attribute_id,trigger_values').eq('attribute_id', f.id))
  const out: string[] = []
  for (const r of rules) {
    const t = await must<any>('trigger', svc.from('attributes').select('slug').eq('id', r.trigger_attribute_id).single())
    out.push(`${t.slug}=${r.trigger_values[0]}`)
  }
  return out
}
let templateId = ''

describe.skipIf(!hasEnv)('sell-form sync (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    fx = await makeFixture()
    svc = fx.svc
    const tag = fx.ns.tag
    const game = await must<any>('game', svc.from('games').insert({ name: `Guard Sell Form ${tag}`, slug: `guard-test-${tag}-sf` }).select('id,slug').single())
    gameId = game.id
    const gc = await must<any>('global', svc.from('global_categories').select('id').eq('slug', 'items').single())
    const pair = await must<any>('pair', svc.from('game_categories').insert({
      game_id: gameId, global_category_id: gc.id, is_enabled: true, slug: `guard-test-items-${tag}`, name: 'Guard Items', type: 'items',
    }).select('id').single())
    gcId = pair.id
    const tpl = await must<any>('template', svc.from('attribute_templates').insert({ game_category_id: gcId, name: 'Items', is_active: true }).select('id').single())
    templateId = tpl.id

    // The hand-made form as it is live on MM2 (2026-10-13).
    const [type, rar, names] = await must<any[]>('fields', svc.from('attributes').insert([
      { template_id: templateId, slug: 'item-type', name: 'Item Type', type: 'select', is_required: true, sort_order: 0, facet_indexed: true },
      { template_id: templateId, slug: 'rarity-2', name: 'Rarity', type: 'select', is_required: true, sort_order: 0, facet_indexed: false },
      { template_id: templateId, slug: 'knife-name-5', name: 'Knife Name', type: 'select', is_required: false, sort_order: 0, facet_indexed: false },
    ]).select('id,slug').order('slug'))
    const byslug = Object.fromEntries([type, rar, names].map((f) => [f.slug, f.id]))
    await must('options', svc.from('attribute_options').insert([
      { attribute_id: byslug['item-type'], slug: 'knives', value: 'knives', label: 'Knives', sort_order: 1 },
      { attribute_id: byslug['item-type'], slug: 'guns', value: 'guns', label: 'Guns', sort_order: 2 },
      { attribute_id: byslug['item-type'], slug: 'effects', value: 'effects', label: 'Effects', sort_order: 3 },
      { attribute_id: byslug['rarity-2'], slug: 'ancient', value: 'ancient', label: 'Ancient', sort_order: 1 },
      { attribute_id: byslug['knife-name-5'], slug: 'hallowscythe', value: 'hallowscythe', label: 'Hallowscythe', sort_order: 1 },
    ]))
    await must('rules', svc.from('attribute_conditional_rules').insert([
      { attribute_id: byslug['rarity-2'], trigger_attribute_id: byslug['item-type'], operator: 'equals', trigger_values: ['knives'] },
      { attribute_id: byslug['knife-name-5'], trigger_attribute_id: byslug['rarity-2'], operator: 'equals', trigger_values: ['ancient'] },
    ]))
    await must('items', svc.from('values_items').insert([
      { game_id: gameId, kind: 'item', slug: 'emberbow', name: 'Emberbow', item_type: 'gun', rarity: 'Ancient', is_enabled: true, is_priced: true },
      { game_id: gameId, kind: 'item', slug: 'hallowscythe', name: 'Hallowscythe', item_type: 'knife', rarity: 'Ancient', is_enabled: true, is_priced: true },
      { game_id: gameId, kind: 'item', slug: 'gingerscythe', name: 'Gingerscythe', item_type: 'knife', rarity: null, is_enabled: true, is_priced: true },
    ]))
    const l = await must<any>('listing', svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: gameId, game_category_id: gcId, title: fx.ns.listingTitle(), description: 'guard test throwaway',
      price: 1, quantity: 1, status: 'draft', template_data: { 'item-type': 'knives', 'rarity-2': 'ancient', 'knife-name-5': 'hallowscythe', note: 'keep me' },
    }).select('id').single())
    listingIds.push(l.id)

    config = {
      gameSlug: game.slug,
      typeField: 'item-type',
      typeFieldName: 'Item Type',
      types: [
        { key: 'knife', label: 'Knives', aliases: ['knife', 'knives'], listName: 'Knife Name' },
        { key: 'gun', label: 'Guns', aliases: ['gun', 'guns'], listName: 'Gun Name' },
      ],
      rarities: ['Common', 'Ancient'],
      legacyFields: ['rarity-2', 'knife-name-5'],
    }
  }, 120_000)

  afterAll(async () => {
    if (!svc) return
    if (listingIds.length) await svc.from('listings').delete().in('id', listingIds)
    if (gameId) await svc.from('games').delete().eq('id', gameId) // pair → template → fields → options → rules; values_items
    await fx.cleanup()
  }, 120_000)

  it('builds the chain, keeps the admin types, and moves the listing onto it', async () => {
    const { report } = await run()
    expect(report.status).toBe('ok')
    expect(await optionValues('item-type')).toEqual(['knives', 'guns', 'effects'])
    expect(await optionValues('rarity-knife')).toEqual(['ancient', 'other'])
    expect(await optionValues('knife-ancient')).toEqual(['hallowscythe', 'other'])
    expect(await optionValues('knife-other')).toEqual(['gingerscythe', 'other'])
    expect(await optionValues('gun-ancient')).toEqual(['emberbow', 'other'])
    expect(await ruleOf('rarity-gun')).toEqual(['item-type=guns'])
    expect(await ruleOf('knife-ancient')).toEqual(['rarity-knife=ancient'])
    expect((await field('gun-ancient')).facet_indexed).toBe(true)

    const l = await must<any>('listing', svc.from('listings').select('template_data').eq('id', listingIds[0]).single())
    expect(l.template_data).toEqual({ 'item-type': 'knives', 'rarity-knife': 'ancient', 'knife-ancient': 'hallowscythe', note: 'keep me' })
    expect(repaired).toEqual([[listingIds[0]]])
    expect(formChanges).toBe(1)
    expect(report.warnings.join(' ')).toMatch(/Gingerscythe/)
    // The hand-made fields no live listing answers any more are gone (one Rarity on screen, not two).
    expect(report.fieldsRetired.sort()).toEqual(['knife-name-5', 'rarity-2'])
    expect(await field('rarity-2')).toBeNull()
    expect(await field('knife-name-5')).toBeNull()
  }, 60_000)

  it('writes nothing on the second run', async () => {
    const { report, plan, repairs } = await run()
    expect(report.status).toBe('nothing_to_do')
    expect(plan?.createOptions).toEqual([])
    expect(plan?.updateOptions).toEqual([])
    expect(repairs).toEqual([])
  }, 60_000)

  it('restores a field and a rule the admin deleted; the listing answers them again', async () => {
    await svc.from('attributes').delete().eq('id', (await field('gun-ancient')).id)
    await svc.from('attribute_conditional_rules').delete().eq('attribute_id', (await field('knife-ancient')).id)
    const { report } = await run()
    expect(report.fieldsCreated).toBe(1)
    expect(await optionValues('gun-ancient')).toEqual(['emberbow', 'other'])
    expect(await ruleOf('knife-ancient')).toEqual(['rarity-knife=ancient'])
    expect(report.listingsRepaired).toBe(0) // its keys never changed
  }, 60_000)

  it('keeps an option the admin added by hand, then adopts it once the catalogue has it', async () => {
    const gun = await field('gun-ancient')
    await must('admin option', svc.from('attribute_options').insert({ attribute_id: gun.id, slug: 'night-bow', value: 'night-bow', label: 'Night Bow', sort_order: 9 }))
    await run()
    expect(await optionValues('gun-ancient')).toEqual(['emberbow', 'night-bow', 'other'])
    await must('new item', svc.from('values_items').insert({ game_id: gameId, kind: 'item', slug: 'nightbow', name: 'Nightbow', item_type: 'gun', rarity: 'Ancient', is_enabled: true, is_priced: true }))
    const { report } = await run()
    expect(report.optionsCreated).toEqual([])
    expect(await optionValues('gun-ancient')).toEqual(['emberbow', 'nightbow', 'other'])
  }, 60_000)

  it('the builder refuses a new key or type on a synced field, and still allows a label rename', async () => {
    const { updateAttribute } = await import('@/lib/actions/admin-template-builder')
    const gun = await field('gun-ancient')
    expect(await updateAttribute({ id: gun.id, slug: 'ancient-guns' })).toEqual({ success: false, error: MANAGED_KEY_MESSAGE })
    expect((await updateAttribute({ id: gun.id, type: 'text' })).success).toBe(false)
    expect((await updateAttribute({ id: gun.id, name: 'Ancient Gun' })).success).toBe(true)
    expect(await field('gun-ancient')).not.toBeNull()
    // A field the sync does not own keeps the old freedom.
    const type = await field('item-type')
    expect((await updateAttribute({ id: type.id, slug: 'item-type' })).success).toBe(true)
  }, 60_000)

  it('places a listing its title re-link just matched in the same run, not under Other', async () => {
    const l = await must<any>('listing', svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: gameId, game_category_id: gcId, title: fx.ns.listingTitle(), description: 'guard test throwaway',
      price: 1, quantity: 1, status: 'draft', template_data: { 'item-type': 'knives', 'rarity-2': 'ancient', 'knife-name-5': 'other' },
    }).select('id').single())
    listingIds.push(l.id)
    titleLinks.set(l.id, 'hallowscythe')
    const { report } = await run()
    expect(report.listingsRepaired).toBe(1)
    const row = await must<any>('listing', svc.from('listings').select('template_data').eq('id', l.id).single())
    expect(row.template_data).toEqual({ 'item-type': 'knives', 'rarity-knife': 'ancient', 'knife-ancient': 'hallowscythe' })
  }, 60_000)

  it('never deletes an option a listing still answers with', async () => {
    const l = await must<any>('listing', svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: gameId, game_category_id: gcId, title: fx.ns.listingTitle(), description: 'guard test throwaway',
      price: 1, quantity: 1, status: 'archived', template_data: { 'item-type': 'guns', 'rarity-gun': 'ancient', 'gun-ancient': 'emberbow' },
    }).select('id').single())
    listingIds.push(l.id)
    await must('disable', svc.from('values_items').update({ is_enabled: false }).eq('game_id', gameId).eq('slug', 'emberbow'))
    const { report } = await run()
    expect(report.optionsDeleted).toBe(0)
    expect(report.optionsKept).toEqual([{ node: 'gun-ancient', value: 'emberbow', reason: 'disabled in the catalogue, but a listing still uses it' }])
    expect(await optionValues('gun-ancient')).toContain('emberbow')
  }, 60_000)
})
