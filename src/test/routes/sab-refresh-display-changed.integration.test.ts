/**
 * sab_refresh_price_display_changed() — PR #89 (migration 20260922172054),
 * shipped without an integration test. It refreshes sab_price_display and
 * returns the brainrot slugs whose PUBLISHED prices moved, so the import
 * route can revalidate per item instead of per game.
 *
 * Drives the real function against the local stack with one throwaway
 * brainrot × two mutations, priced through a `manual_override` external
 * observation (evidence rank 0, no date window — the shortest path into
 * sab_public_price_catalog_corrected). Asserts the diff is exact:
 *   · first refresh: the pair appears → its slug is returned
 *   · second refresh, nothing moved: the slug is NOT returned
 *   · one mutation's price moves: exactly that slug, once
 *   · the row disappears (observation deactivated): the slug is returned
 * An unrelated fixture item whose price never moves is never returned.
 *
 * Shared-stack caveat: another session's crawl import can move real prices
 * mid-test, so the assertions are on OUR slugs only (never "returns []").
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertGuardTargetAllowed } from '@/test/guards/throwaway'
import { supabaseReachable } from '@/test/supabase-reachable'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasEnv = Boolean(URL && SVC)
const tag = Math.random().toString(36).slice(2, 8)

let svc: SupabaseClient
let brainrotA = ''
let brainrotB = ''
let mutDefault = ''
let mutGold = ''
let obsA1 = ''
let obsA2 = ''
let obsB = ''
let createdDefaultMutation = false
const slugA = `guard-test-a-${tag}`
const slugB = `guard-test-b-${tag}`

async function refreshChanged(): Promise<string[]> {
  const { data, error } = await (svc.rpc as any)('sab_refresh_price_display_changed')
  if (error) throw new Error(`sab_refresh_price_display_changed: ${error.message}`)
  return (data as { brainrot_slug: string }[]).map((r) => r.brainrot_slug)
}
async function displayRows(slug: string) {
  const { data, error } = await svc.from('sab_price_display').select('mutation_slug, market_value_usd, cheapest_usd').eq('brainrot_slug', slug).order('mutation_slug')
  if (error) throw new Error(error.message)
  return data as { mutation_slug: string; market_value_usd: number | null; cheapest_usd: number | null }[]
}
async function insertObservation(brainrotId: string, mutationId: string, priceUsd: number): Promise<string> {
  const { data, error } = await svc.from('sab_external_market_observations').insert({
    brainrot_id: brainrotId, mutation_id: mutationId, observation_type: 'manual_override',
    source_name: `guard-test-${tag}`, price_usd: priceUsd, observed_at: new Date().toISOString(),
    notes: 'sab-refresh-display-changed integration fixture',
  }).select('id').single()
  if (error) throw new Error(`observation insert: ${error.message}`)
  return (data as any).id
}

describe.skipIf(!hasEnv)('sab_refresh_price_display_changed — returns exactly the moved slugs (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    if (!(await supabaseReachable(URL))) throw new Error(`no Supabase reachable at ${URL}`)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })

    // Mutations: the catalogue's `default` slug is shared (unique); reuse it
    // when the stack has one, create it otherwise. The second is ours.
    const { data: def } = await svc.from('sab_mutations').select('id').eq('slug', 'default').maybeSingle()
    if (def) {
      mutDefault = (def as any).id
    } else {
      const { data, error } = await svc.from('sab_mutations').insert({ name: 'Default', slug: 'default', mutation_type: 'default' }).select('id').single()
      if (error) throw new Error(`default mutation insert: ${error.message}`)
      mutDefault = (data as any).id
      createdDefaultMutation = true
    }
    const { data: gold, error: ge } = await svc.from('sab_mutations').insert({ name: `Guard Gold ${tag}`, slug: `guard-test-gold-${tag}`, mutation_type: 'permanent' }).select('id').single()
    if (ge) throw new Error(`gold mutation insert: ${ge.message}`)
    mutGold = (gold as any).id

    for (const [slug, setter] of [[slugA, (id: string) => (brainrotA = id)], [slugB, (id: string) => (brainrotB = id)]] as const) {
      const { data, error } = await svc.from('sab_brainrots').insert({
        // sab_brainrot_catalog admits only active, reviewed, image-approved rows.
        name: `Guard Test ${slug}`, slug, rarity: 'Common', obtainability: 'obtainable',
        needs_review: false, image_status: 'approved', image_path: `guard-test-${tag}.png`,
      }).select('id').single()
      if (error) throw new Error(`brainrot insert: ${error.message}`)
      setter((data as any).id)
    }
    obsA1 = await insertObservation(brainrotA, mutDefault, 10)
    obsA2 = await insertObservation(brainrotA, mutGold, 25)
    obsB = await insertObservation(brainrotB, mutDefault, 7)
  }, 60_000)

  afterAll(async () => {
    if (!svc) return
    const failures: string[] = []
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p
      if (error) failures.push(`${label}: ${error.message}`)
    }
    // Observations cascade from the brainrot; corrections/history keyed on our ids.
    for (const id of [brainrotA, brainrotB].filter(Boolean)) {
      await del('sab_price_corrections', svc.from('sab_price_corrections').delete().eq('brainrot_id', id))
      await del('sab_price_display', svc.from('sab_price_display').delete().eq('brainrot_id', id))
      await del('sab_brainrots', svc.from('sab_brainrots').delete().eq('id', id))
    }
    if (mutGold) await del('sab_mutations(gold)', svc.from('sab_mutations').delete().eq('id', mutGold))
    if (createdDefaultMutation) await del('sab_mutations(default)', svc.from('sab_mutations').delete().eq('id', mutDefault))
    // Leave the display table as the next crawl would: refreshed without us.
    await refreshChanged().catch((e) => failures.push(`final refresh: ${e.message}`))
    const { data: residue } = await svc.from('sab_price_display').select('brainrot_slug').in('brainrot_slug', [slugA, slugB])
    if ((residue ?? []).length) failures.push(`${(residue ?? []).length} display row(s) remain for ${slugA}/${slugB}`)
    if (failures.length) throw new Error(`sab-refresh-display-changed cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 60_000)

  it('a newly priced item appears in the display table and its slug is returned once', async () => {
    const changed = await refreshChanged()
    expect(changed.filter((s) => s === slugA)).toHaveLength(1)
    expect(changed.filter((s) => s === slugB)).toHaveLength(1)
    const rows = await displayRows(slugA)
    expect(rows.map((r) => r.mutation_slug).sort()).toEqual(['default', `guard-test-gold-${tag}`].sort())
    expect(rows.find((r) => r.mutation_slug === 'default')?.market_value_usd).toBe(10)
  }, 60_000)

  it('a refresh where nothing moved returns neither of our slugs', async () => {
    const changed = await refreshChanged()
    expect(changed).not.toContain(slugA)
    expect(changed).not.toContain(slugB)
    // refreshed_at moved on every row — deliberately NOT a change.
    expect((await displayRows(slugA)).length).toBe(2)
  }, 60_000)

  it('moving ONE mutation price returns exactly that item, once; the unmoved item is not returned', async () => {
    const { error } = await svc.from('sab_external_market_observations').update({ price_usd: 30 }).eq('id', obsA2)
    if (error) throw new Error(error.message)
    const changed = await refreshChanged()
    expect(changed.filter((s) => s === slugA)).toHaveLength(1)
    expect(changed).not.toContain(slugB)
    const gold = (await displayRows(slugA)).find((r) => r.mutation_slug === `guard-test-gold-${tag}`)
    expect(gold?.market_value_usd).toBe(30)
    // Same value written again: no movement, not returned.
    await svc.from('sab_external_market_observations').update({ price_usd: 30 }).eq('id', obsA2)
    expect(await refreshChanged()).not.toContain(slugA)
  }, 60_000)

  it('a pair that disappears is reported; the other item is still not', async () => {
    const { error } = await svc.from('sab_external_market_observations').update({ is_active: false }).eq('id', obsA1)
    if (error) throw new Error(error.message)
    const changed = await refreshChanged()
    expect(changed.filter((s) => s === slugA)).toHaveLength(1)
    expect(changed).not.toContain(slugB)
    expect((await displayRows(slugA)).map((r) => r.mutation_slug)).toEqual([`guard-test-gold-${tag}`])
    // And the reverse: re-activate → appears again → reported once.
    await svc.from('sab_external_market_observations').update({ is_active: true }).eq('id', obsA1)
    expect((await refreshChanged()).filter((s) => s === slugA)).toHaveLength(1)
    void obsB
  }, 60_000)
})
