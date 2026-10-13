/**
 * The block editor's save (saveBlogPost, 2026-10-12), against the local stack:
 *
 *   · create then save again with the returned id → ONE row (the old editor
 *     made a duplicate on a second Save);
 *   · the body is stored as { v: 2, doc, cover }, tagged with its game, with
 *     read time computed from the words;
 *   · the first publish of a draft stamps published_at = now; an edit of a
 *     live post keeps it;
 *   · an image with no description still publishes (captions and descriptions are optional);
 *   · a second post on the same game + URL gets a plain-words error.
 *
 * Rows are minted through this file's namespace and every one is deleted in
 * afterAll; IndexNow and revalidation are mocked (no network, no side rows).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ANON, SVC, URL, assertGuardTargetAllowed, hasEnv } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'

vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => ({ userId: '00000000-0000-0000-0000-000000000000', email: 'guard@example.com', role: 'super_admin', permissions: [] }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/seo/indexnow', () => ({ submitPostEvent: async () => undefined }))
vi.mock('server-only', () => ({}))
// React's request cache exists only in the server build; outside it, call through.
vi.mock('react', async (load) => ({ ...(await load<typeof import('react')>()), cache: <T,>(fn: T) => fn }))

const ns = fixtureNamespace()
const slugOf = (label: string) => `guardtest-blog-${ns.tag}-${label}`
const SLUG_LIKE = `guardtest-blog-${ns.key}%`

let svc: SupabaseClient
let game = ''

const doc = (words = 10, extra: any[] = []) => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'First' }] },
    { type: 'paragraph', content: [{ type: 'text', text: Array.from({ length: words }, (_, i) => `w${i}`).join(' ') }] },
    ...extra,
  ],
})

function input(slug: string, over: Record<string, unknown> = {}) {
  return {
    title: 'Guard Test Post',
    slug,
    excerpt: 'A short summary for the guard test.',
    author: 'DropMarket Team',
    postType: 'guide' as const,
    status: 'draft' as const,
    gameSlug: game,
    coverUrl: null,
    cover: null,
    seoTitle: null,
    seoDescription: null,
    doc: doc(),
    ...over,
  }
}

async function rows(slug: string) {
  const { data, error } = await svc.from('blog_posts').select('id, status, published_at, body, game_slugs, read_minutes').eq('slug', slug)
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

describe.skipIf(!hasEnv)('blog save (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    void ANON
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { data } = await svc.from('games').select('slug').eq('is_active', true).order('slug').limit(1).single()
    game = (data as { slug: string }).slug
  })

  afterAll(async () => {
    if (!svc) return
    await svc.from('blog_posts').delete().like('slug', SLUG_LIKE)
    const { count } = await svc.from('blog_posts').select('id', { count: 'exact' }).like('slug', SLUG_LIKE)
    expect(count ?? 0).toBe(0)
  })

  it('create, then save again with the id: one row, v2 body, game tag, read time', async () => {
    const { saveBlogPost } = await import('@/lib/actions/admin-blog-save')
    const slug = slugOf('once')
    const first = await saveBlogPost(null, input(slug))
    expect(first.success).toBe(true)
    if (!first.success) return
    const again = await saveBlogPost(first.id, input(slug, { doc: doc(600) }))
    expect(again).toMatchObject({ success: true, id: first.id })

    const found = await rows(slug)
    expect(found).toHaveLength(1)
    expect(found[0].body).toMatchObject({ v: 2, doc: { type: 'doc' }, cover: null })
    expect(found[0].game_slugs).toEqual([game])
    expect(found[0].read_minutes).toBe(3) // 601 words / 220 a minute, rounded up
  })

  it('the first publish of a draft stamps published_at; an edit of a live post keeps it', async () => {
    const { saveBlogPost } = await import('@/lib/actions/admin-blog-save')
    const slug = slugOf('pub')
    const created = await saveBlogPost(null, input(slug))
    if (!created.success) throw new Error(created.error)
    await svc.from('blog_posts').update({ published_at: '2020-01-01T00:00:00Z' }).eq('id', created.id)

    const before = Date.now()
    const live = await saveBlogPost(created.id, input(slug, { status: 'published' }))
    expect(live.success).toBe(true)
    const stamped = new Date((await rows(slug))[0].published_at).getTime()
    expect(stamped).toBeGreaterThanOrEqual(before - 5_000)

    await saveBlogPost(created.id, input(slug, { status: 'published', title: 'Guard Test Post Edited' }))
    expect(new Date((await rows(slug))[0].published_at).getTime()).toBe(stamped)
  })

  it('publishes a post whose image has no caption or description', async () => {
    const { saveBlogPost } = await import('@/lib/actions/admin-blog-save')
    const slug = slugOf('alt')
    const created = await saveBlogPost(null, input(slug))
    if (!created.success) throw new Error(created.error)
    const figure = { type: 'figure', attrs: { src: 'https://example.com/a.webp', alt: '', caption: '', layout: 'column' } }
    const res = await saveBlogPost(created.id, input(slug, { status: 'published', doc: doc(10, [figure]) }))
    expect(res.success).toBe(true)
    expect((await rows(slug))[0].status).toBe('published')
  })

  it('a second post on the same game and URL gets a plain-words error', async () => {
    const { saveBlogPost } = await import('@/lib/actions/admin-blog-save')
    const slug = slugOf('dup')
    const first = await saveBlogPost(null, input(slug))
    expect(first.success).toBe(true)
    const second = await saveBlogPost(null, input(slug))
    expect(second).toEqual({ success: false, error: 'Another post in this game already uses that URL slug.' })
    expect(await rows(slug)).toHaveLength(1)
  })

  it('renaming a live post keeps its old URL, which finds the post for the redirect', async () => {
    const { saveBlogPost } = await import('@/lib/actions/admin-blog-save')
    const { getPublishedPostBySlugAnyGame } = await import('@/lib/blog/db')
    const oldSlug = slugOf('ren-a')
    const newSlug = slugOf('ren-b')
    const created = await saveBlogPost(null, input(oldSlug, { status: 'published' }))
    if (!created.success) throw new Error(created.error)
    const renamed = await saveBlogPost(created.id, input(newSlug, { status: 'published' }))
    expect(renamed.success).toBe(true)
    expect((await rows(newSlug))[0].body.oldSlugs).toEqual([oldSlug])
    expect(await getPublishedPostBySlugAnyGame(oldSlug)).toEqual({ slug: newSlug, primaryGameSlug: game })
  })
})
