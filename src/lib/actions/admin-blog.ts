'use server'

/**
 * Admin CRUD for the blog/content CMS (blog_posts table).
 * Mirrors admin-categories.ts: requireAdmin gate + service-role client for
 * mutations (bypasses RLS) + revalidatePath on the affected public routes.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'
import { submitPostEvent } from '@/lib/seo/indexnow'

export type BlogPostType = 'guide' | 'value' | 'seller' | 'codes'
export type BlogStatus = 'draft' | 'published' | 'archived'

export interface AdminBlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  author: string
  read_minutes: number
  post_type: BlogPostType
  status: BlogStatus
  primary_game_slug: string | null
  game_slugs: string[]
  cover_url: string | null
  /** Stored as is: a legacy markdown array or `{ v: 2, doc, cover }` (read with readBody). */
  body: unknown
  seo_title: string | null
  seo_description: string | null
  published_at: string
  updated_at: string
}

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Public routes a post affects — revalidate these after a write. */
function revalidatePostPaths(gameSlug: string | null, slug: string) {
  revalidatePath('/admin/blog')
  revalidatePath('/blog')
  if (gameSlug) {
    revalidatePath(`/${gameSlug}/blog`)
    revalidatePath(`/${gameSlug}/blog/${slug}`)
    revalidatePath(`/${gameSlug}`) // Overview surfaces latest guides.
  }
}

// IndexNow for posts: lib/seo/indexnow submitPostEvent (post + its blog index;
// production only, never throws). Publish and edit of a published post submit;
// so do unpublish and delete of one that was live.

/** All posts for the admin list (any status), newest first. */
export async function fetchAdminBlogPosts(): Promise<AdminBlogPost[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map(normalizeRow)
}

export async function fetchAdminBlogPost(id: string): Promise<AdminBlogPost | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return normalizeRow(data)
}

export async function deleteBlogPost(id: string) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  // Grab the paths before deleting so we can revalidate them.
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('primary_game_slug, slug, status')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }
  if (existing) {
    const gone = existing as { primary_game_slug: string | null; slug: string; status: string }
    revalidatePostPaths(gone.primary_game_slug, gone.slug)
    // A deleted post that was live is a page engines should see disappear.
    if (gone.status === 'published') await submitPostEvent('removed', { gameSlug: gone.primary_game_slug, slug: gone.slug })
  }
  return { success: true as const }
}

export async function setBlogPostStatus(id: string, status: BlogStatus) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data: previous } = await supabase.from('blog_posts').select('status').eq('id', id).maybeSingle()
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status })
    .eq('id', id)
    .select('primary_game_slug, slug')
    .single()
  if (error) return { success: false as const, error: error.message }
  const r = data as { primary_game_slug: string | null; slug: string }
  revalidatePostPaths(r.primary_game_slug, r.slug)
  const wasPublished = (previous as { status?: string } | null)?.status === 'published'
  if (status === 'published') await submitPostEvent('published', { gameSlug: r.primary_game_slug, slug: r.slug })
  else if (wasPublished) await submitPostEvent('removed', { gameSlug: r.primary_game_slug, slug: r.slug })
  return { success: true as const }
}

// ─── mappers ────────────────────────────────────────────────────────────────

function normalizeRow(row: any): AdminBlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? '',
    author: row.author ?? 'DropMarket Team',
    read_minutes: row.read_minutes ?? 5,
    post_type: row.post_type ?? 'guide',
    status: row.status ?? 'draft',
    primary_game_slug: row.primary_game_slug ?? null,
    game_slugs: Array.isArray(row.game_slugs) ? row.game_slugs : [],
    cover_url: row.cover_url ?? null,
    body: row.body ?? null,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    published_at: row.published_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}
