'use server'

/**
 * Save a post from the block editor (2026-10-12) — ONE action for create and
 * update, so the editor can't insert twice (the old editor stayed on /new
 * after a create and a second Save made a duplicate).
 *
 *  - Validated with zod; errors come back in plain words.
 *  - Publishing runs the same blocking checks as the editor's checklist
 *    (title, slug, game, alt text on every image) on the server.
 *  - The first publish of a draft stamps published_at = now (a draft used to
 *    go live with its creation date).
 *  - Read time is computed from the words.
 *  - A rename or a move to another game also refreshes the OLD page, whose
 *    route then redirects to the new address.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { submitPostEvent } from '@/lib/seo/indexnow'
import { postChecklist } from '@/lib/blog/editor/checklist'
import { docReadMinutes } from '@/lib/blog/render/outline'
import type { BlogDoc } from '@/lib/blog/doc/types'

const StoredImageSchema = z.object({
  src: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blur: z.string().nullable(),
  sources: z.object({
    avif: z.array(z.object({ w: z.number(), url: z.string().url() })),
    webp: z.array(z.object({ w: z.number(), url: z.string().url() })),
  }),
})

const SaveSchema = z.object({
  title: z.string().trim().min(1, 'Give the post a title.').max(200, 'The title is too long (200 max).'),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'The URL slug can only use a–z, 0–9 and dashes.').max(80),
  excerpt: z.string().trim().max(400, 'The summary is too long (400 max).'),
  author: z.string().trim().min(1).max(80),
  postType: z.enum(['guide', 'value', 'seller']),
  status: z.enum(['draft', 'published', 'archived']),
  gameSlug: z.string().trim().regex(/^[a-z0-9-]+$/).nullable(),
  // A legacy post's cover: an https URL or a site path.
  coverUrl: z.string().max(2000).refine((v) => v.startsWith('/') || v.startsWith('https://'), 'The cover address is not valid.').nullable(),
  cover: StoredImageSchema.nullable(),
  seoTitle: z.string().trim().max(120).nullable(),
  seoDescription: z.string().trim().max(300).nullable(),
  doc: z.object({ type: z.literal('doc'), content: z.array(z.any()) }).passthrough(),
})

export type SaveBlogPostInput = z.input<typeof SaveSchema>
type Result = { success: true; id: string; updatedAt: string } | { success: false; error: string }

function admin() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

function refresh(gameSlug: string | null, slug: string) {
  revalidatePath('/admin/blog')
  revalidatePath('/blog')
  if (gameSlug) {
    revalidatePath(`/${gameSlug}/blog`)
    revalidatePath(`/${gameSlug}/blog/${slug}`)
    revalidatePath(`/${gameSlug}`)
  } else {
    revalidatePath(`/blog/${slug}`)
  }
}

export async function saveBlogPost(id: string | null, raw: SaveBlogPostInput): Promise<Result> {
  await requireAdmin()
  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the post fields.' }
  const p = parsed.data
  const doc = p.doc as unknown as BlogDoc
  if (JSON.stringify(doc).length > 1_500_000) return { success: false, error: 'The post is too large to save. Split it into two.' }

  if (p.status === 'published') {
    const { blocking } = postChecklist({ title: p.title, slug: p.slug, gameSlug: p.gameSlug, excerpt: p.excerpt, seoDescription: p.seoDescription ?? '', hasCover: !!(p.cover || p.coverUrl), doc })
    if (blocking.length) return { success: false, error: `Before publishing: ${blocking.map((b) => b.label.toLowerCase()).join(', ')}.` }
  }

  const supabase = admin()
  const previous = id
    ? ((await supabase.from('blog_posts').select('slug, primary_game_slug, status').eq('id', id).maybeSingle()).data as
        | { slug: string; primary_game_slug: string | null; status: string }
        | null)
    : null
  if (id && !previous) return { success: false, error: 'This post no longer exists.' }

  const row = {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    author: p.author,
    post_type: p.postType,
    status: p.status,
    primary_game_slug: p.gameSlug,
    game_slugs: p.gameSlug ? [p.gameSlug] : [],
    cover_url: p.cover?.sources.webp.find((s) => s.w >= 1200)?.url ?? p.cover?.src ?? p.coverUrl,
    body: { v: 2, doc, cover: p.cover },
    read_minutes: docReadMinutes(doc),
    seo_title: p.seoTitle || null,
    seo_description: p.seoDescription || null,
    ...(p.status === 'published' && (!previous || previous.status === 'draft') ? { published_at: new Date().toISOString() } : {}),
  }

  const write = id
    ? supabase.from('blog_posts').update(row).eq('id', id).select('id, updated_at').single()
    : supabase.from('blog_posts').insert(row).select('id, updated_at').single()
  const { data, error } = await write
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Another post in this game already uses that URL slug.' }
    return { success: false, error: `Could not save: ${error.message}` }
  }
  const saved = data as { id: string; updated_at: string }

  refresh(p.gameSlug, p.slug)
  if (previous && (previous.slug !== p.slug || previous.primary_game_slug !== p.gameSlug)) refresh(previous.primary_game_slug, previous.slug)

  const wasLive = previous?.status === 'published'
  if (p.status === 'published') await submitPostEvent(wasLive ? 'edited' : 'published', { gameSlug: p.gameSlug, slug: p.slug })
  else if (wasLive) await submitPostEvent('removed', { gameSlug: previous!.primary_game_slug, slug: previous!.slug })

  return { success: true, id: saved.id, updatedAt: saved.updated_at }
}
