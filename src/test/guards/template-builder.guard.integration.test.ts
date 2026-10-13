/**
 * Item fields builder (2026-10-12 rebuild), against the local stack:
 *  - the builder reads ONLY its template's options, all of them past
 *    PostgREST's 1,000-row cap, in admin order (it used to read every game's
 *    options unfiltered and silently lost MM2's tail);
 *  - new choices and new sub-fields go last with no tied sort_order (it used
 *    to number by list length, so a delete then an add collided, and every
 *    sub-field got 0);
 *  - every write refreshes the seller form's cached template.
 * The admin check and next/cache are mocked (no Next runtime in vitest).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertGuardTargetAllowed, hasEnv, purgeNamespace } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { SELL_TEMPLATE_TAG } from '@/lib/sell/template-tags'

const revalidated: string[] = []
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => ({ userId: 'guard-admin', email: 'guard@example.com', role: 'super_admin', permissions: [] }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidated.push(`path:${p}`),
  revalidateTag: (t: string) => revalidated.push(`tag:${t}`),
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))

const ns = fixtureNamespace()
let svc: SupabaseClient
let gameId = ''
const OPTION_COUNT = 1_050

describe.skipIf(!hasEnv)('item fields builder (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await purgeNamespace(svc, ns)
    const { data: g, error: ge } = await svc.from('games').insert({ name: `Guard Builder ${ns.tag}`, slug: `guard-test-${ns.tag}-tb` }).select('id').single()
    if (ge) throw ge
    gameId = (g as { id: string }).id
    const { data: gc } = await svc.from('global_categories').select('id').eq('slug', 'items').single()
    const { error: ce } = await svc.from('game_categories').insert({
      game_id: gameId, global_category_id: (gc as { id: string }).id, is_enabled: true, slug: `guard-test-items-${ns.tag}`, name: 'Guard Items', type: 'items',
    })
    if (ce) throw ce
  }, 120_000)

  afterAll(async () => {
    // The game delete cascades its pair → template → fields → choices → rules.
    const failures = svc ? await purgeNamespace(svc, ns) : []
    expect(failures).toEqual([])
  }, 120_000)

  it('reads every option of THIS template past 1,000 rows, in admin order', async () => {
    const { loadBuilderState, createAttribute } = await import('@/lib/actions/admin-template-builder')
    const first = await loadBuilderState(gameId, 'items')
    if (!first.success) throw new Error(first.error)
    const tpl = first.data.template!.id
    const made = await createAttribute({ template_id: tpl, name: 'Knife Name', type: 'select' })
    if (!made.success) throw new Error(made.error)
    // Reverse insert order, so only sort_order can put them right.
    const rows = Array.from({ length: OPTION_COUNT }, (_, i) => {
      const n = OPTION_COUNT - 1 - i
      return { attribute_id: made.data.id, slug: `k-${n}`, value: `k-${n}`, label: `Knife ${n}`, sort_order: n }
    })
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await svc.from('attribute_options').insert(rows.slice(i, i + 500))
      if (error) throw error
    }
    const res = await loadBuilderState(gameId, 'items')
    if (!res.success) throw new Error(res.error)
    const field = res.data.attributes.find((a) => a.id === made.data.id)!
    expect(field.options).toHaveLength(OPTION_COUNT)
    expect(field.options.map((o) => o.sort_order)).toEqual(Array.from({ length: OPTION_COUNT }, (_, i) => i))
    const ids = new Set(res.data.attributes.map((a) => a.id))
    expect(res.data.attributes.flatMap((a) => a.options).every((o) => ids.has(o.attribute_id))).toBe(true)
  }, 120_000)

  it('a new choice after a delete goes last, never on a used sort_order', async () => {
    const { loadBuilderState, createAttribute, createOption, deleteOption } = await import('@/lib/actions/admin-template-builder')
    const st = await loadBuilderState(gameId, 'items')
    if (!st.success) throw new Error(st.error)
    const f = await createAttribute({ template_id: st.data.template!.id, name: 'Rarity', type: 'select' })
    if (!f.success) throw new Error(f.error)
    const ids: string[] = []
    for (const label of ['Common', 'Uncommon', 'Rare']) {
      const r = await createOption({ attribute_id: f.data.id, label })
      if (!r.success) throw new Error(r.error)
      ids.push(r.data.id)
    }
    await deleteOption(ids[0])
    revalidated.length = 0
    const added = await createOption({ attribute_id: f.data.id, label: 'Godly' })
    if (!added.success) throw new Error(added.error)
    const { data } = await svc.from('attribute_options').select('label, sort_order').eq('attribute_id', f.data.id).order('sort_order')
    expect(data).toEqual([
      { label: 'Uncommon', sort_order: 1 },
      { label: 'Rare', sort_order: 2 },
      { label: 'Godly', sort_order: 3 },
    ])
    expect(revalidated).toContain(`tag:${SELL_TEMPLATE_TAG}`)
  }, 120_000)

  it('sub-fields of one choice get their own order, no 0 ties', async () => {
    const { loadBuilderState, createAttribute, createSubAttribute } = await import('@/lib/actions/admin-template-builder')
    const st = await loadBuilderState(gameId, 'items')
    if (!st.success) throw new Error(st.error)
    const tpl = st.data.template!.id
    const type = await createAttribute({ template_id: tpl, name: 'Item Type', type: 'select' })
    if (!type.success) throw new Error(type.error)
    const a = await createSubAttribute({ template_id: tpl, name: 'Pet Name', type: 'select', trigger_attribute_id: type.data.id, trigger_value: 'pets' })
    const b = await createSubAttribute({ template_id: tpl, name: 'Pet Age', type: 'select', trigger_attribute_id: type.data.id, trigger_value: 'pets' })
    if (!a.success || !b.success) throw new Error('sub-field create failed')
    const { data } = await svc.from('attributes').select('id, sort_order').in('id', [type.data.id, a.data.id, b.data.id])
    const order = new Map((data ?? []).map((r: { id: string; sort_order: number }) => [r.id, r.sort_order]))
    expect(order.get(a.data.id)!).toBeGreaterThan(order.get(type.data.id)!)
    expect(order.get(b.data.id)!).toBeGreaterThan(order.get(a.data.id)!)
  }, 120_000)
})
