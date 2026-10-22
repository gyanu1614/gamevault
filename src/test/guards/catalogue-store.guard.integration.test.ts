/**
 * Catalogue pipeline against the local stack: refs/runs round-trips and the
 * SAB adapter's insert-only writes. Rows use this file's fixture namespace
 * (guard-test-<key>…) and are all removed in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { loadRefs, pruneRuns, recordRun, saveRefs } from '@/lib/catalogue/store'
import { PIPELINE_MARK, stealABrainrot } from '@/lib/catalogue/games/steal-a-brainrot'
import type { ParsedItem } from '@/lib/catalogue/types'

const ns = fixtureNamespace()
const GAME = `guard-test-${ns.tag}`
const slug = (s: string) => `guard-test-${ns.tag}-${s}`
let svc: SupabaseClient

const item = (s: string, imageFile: string | null = 'X.png'): ParsedItem => ({
  pageId: 990_000 + s.length,
  revisionId: 1,
  wikiTitle: slug(s),
  pageUrl: 'https://stealabrainrot.fandom.com/wiki/X',
  slug: slug(s),
  name: slug(s),
  rarity: 'Secret',
  imageFile,
  releasedAt: '2026-10-18',
  origin: 'Red Carpet',
  howToGet: null,
  extra: { income: 1000, cost: 5000, obtainability: 'obtainable', categories: [] },
})

describe.skipIf(!hasEnv)('catalogue pipeline: store + SAB adapter (guard)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
  })
  afterAll(async () => {
    await svc.from('catalogue_refs').delete().like('game_slug', `guard-test-${ns.key}%`)
    await svc.from('catalogue_runs').delete().like('game_slug', `guard-test-${ns.key}%`)
    await svc.from('sab_brainrots').delete().like('slug', `guard-test-${ns.key}%`)
    const left = await svc.from('sab_brainrots').select('slug').like('slug', `guard-test-${ns.key}%`)
    expect(left.data).toEqual([])
  })

  it('saves refs and keeps first_seen_at when a ref is updated', async () => {
    await saveRefs(svc, GAME, [{ pageId: 1, wikiTitle: 'A', itemSlug: null, status: 'ignored' }], new Date('2026-10-01T00:00:00Z'))
    const first = (await loadRefs(svc, GAME)).get(1)!
    await saveRefs(svc, GAME, [{ pageId: 1, wikiTitle: 'A', itemSlug: 'a', status: 'item' }], new Date('2026-10-21T00:00:00Z'))
    const again = (await loadRefs(svc, GAME)).get(1)!
    expect(again).toMatchObject({ status: 'item', itemSlug: 'a', firstSeenAt: first.firstSeenAt })
    expect(Date.parse(again.checkedAt)).toBe(Date.parse('2026-10-21T00:00:00Z'))
  })

  it('records runs and prunes old ones', async () => {
    const report = {
      gameSlug: GAME,
      status: 'ok' as const,
      listed: 3,
      candidates: 2,
      adopted: 1,
      added: [{ slug: 'x', name: 'X' }],
      ignored: 1,
      imagesFixed: 0,
      parseErrors: [],
      message: null,
      wikiRequests: 4,
    }
    await recordRun(svc, { report, startedAt: new Date('2025-01-01T00:00:00Z'), finishedAt: new Date('2025-01-01T00:01:00Z'), trigger: 'manual' })
    await recordRun(svc, { report, startedAt: new Date(), finishedAt: new Date(), trigger: 'schedule' })
    await pruneRuns(svc, new Date())
    const { data } = await svc.from('catalogue_runs').select('trigger,added_slugs,details').eq('game_slug', GAME)
    expect(data).toEqual([{ trigger: 'schedule', added_slugs: ['x'], details: { parse_errors: [], wiki_requests: 4 } }])
  })

  it('inserts only new brainrots, never rewrites an existing one, and returns what it inserted', async () => {
    const images = { copy: async (file: string) => file === 'X.png' }
    expect(await stealABrainrot.insert(svc, [item('a'), item('bb', null)], images)).toEqual([slug('a'), slug('bb')])
    await svc.from('sab_brainrots').update({ rarity: 'OG' }).eq('slug', slug('a'))
    expect(await stealABrainrot.insert(svc, [item('a')], images)).toEqual([])
    const { data } = await svc
      .from('sab_brainrots')
      .select('slug,rarity,image_status,image_path,needs_review,source_payload')
      .like('slug', `guard-test-${ns.key}%`)
      .order('slug')
    expect(data).toMatchObject([
      { slug: slug('a'), rarity: 'OG', image_status: 'approved', image_path: `${slug('a')}.webp`, needs_review: false },
      { slug: slug('bb'), image_status: 'missing', image_path: null, source_payload: { imported_by: PIPELINE_MARK } },
    ])
    const known = await stealABrainrot.loadKnown(svc)
    expect(known.find((k) => k.slug === slug('a'))).toMatchObject({ pageId: 990_001 })
  })

  it('fixes a missing image on a pipeline-added row once the copy works', async () => {
    await svc.from('sab_brainrots').update({ source_payload: { imported_by: PIPELINE_MARK, image_file: 'Y.png' } }).eq('slug', slug('bb'))
    const fixed = await stealABrainrot.fixMissingImages!(svc, { copy: async () => true })
    expect(fixed).toContain(slug('bb'))
    const { data } = await svc.from('sab_brainrots').select('image_status,image_path').eq('slug', slug('bb')).single()
    expect(data).toEqual({ image_status: 'approved', image_path: `${slug('bb')}.webp` })
  })
})
