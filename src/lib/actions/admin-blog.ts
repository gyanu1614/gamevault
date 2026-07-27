'use server'

/**
 * Admin CRUD for the blog/content CMS (blog_posts table).
 * Mirrors admin-categories.ts: requireAdmin gate + service-role client for
 * mutations (bypasses RLS) + revalidatePath on the affected public routes.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'
import { pingIndexNow } from '@/lib/seo/indexnow'

export type BlogPostType = 'guide' | 'value' | 'seller'
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
  body: string[]
  seo_title: string | null
  seo_description: string | null
  published_at: string
  updated_at: string
}

export interface BlogPostInput {
  slug: string
  title: string
  excerpt?: string
  author?: string
  read_minutes?: number
  post_type?: BlogPostType
  status?: BlogStatus
  primary_game_slug?: string | null
  game_slugs?: string[]
  cover_url?: string | null
  /** Array of paragraph/section strings. */
  body?: string[]
  seo_title?: string | null
  seo_description?: string | null
  published_at?: string
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
    revalidatePath(`/${gameSlug}/blogs`)
    revalidatePath(`/${gameSlug}/blogs/${slug}`)
    revalidatePath(`/${gameSlug}`) // Overview surfaces latest guides.
  }
}

/** Ping IndexNow for a freshly published post (no-op outside prod). */
async function pingPost(gameSlug: string | null, slug: string) {
  const path = gameSlug ? `/${gameSlug}/blogs/${slug}` : `/blog/${slug}`
  try {
    await pingIndexNow([path])
  } catch {
    /* never break a publish over an SEO ping */
  }
}

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

export async function insertBlogPost(input: BlogPostInput) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const row = toRow(input)
  const { data, error } = await supabase.from('blog_posts').insert(row).select('id').single()
  if (error) return { success: false as const, error: error.message }
  revalidatePostPaths(row.primary_game_slug, row.slug)
  if (row.status === 'published') await pingPost(row.primary_game_slug, row.slug)
  return { success: true as const, id: (data as { id: string }).id }
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const row = toRow(input)
  const { error } = await supabase.from('blog_posts').update(row).eq('id', id)
  if (error) return { success: false as const, error: error.message }
  revalidatePostPaths(row.primary_game_slug, row.slug)
  if (row.status === 'published') await pingPost(row.primary_game_slug, row.slug)
  return { success: true as const }
}

export async function deleteBlogPost(id: string) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  // Grab the paths before deleting so we can revalidate them.
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('primary_game_slug, slug')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }
  if (existing) {
    revalidatePostPaths(
      (existing as { primary_game_slug: string | null }).primary_game_slug,
      (existing as { slug: string }).slug,
    )
  }
  return { success: true as const }
}

export async function setBlogPostStatus(id: string, status: BlogStatus) {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status })
    .eq('id', id)
    .select('primary_game_slug, slug')
    .single()
  if (error) return { success: false as const, error: error.message }
  const r = data as { primary_game_slug: string | null; slug: string }
  revalidatePostPaths(r.primary_game_slug, r.slug)
  if (status === 'published') await pingPost(r.primary_game_slug, r.slug)
  return { success: true as const }
}

// ─── mappers ────────────────────────────────────────────────────────────────

function toRow(input: BlogPostInput) {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    excerpt: (input.excerpt ?? '').trim(),
    author: (input.author ?? 'DropMarket Team').trim(),
    read_minutes: input.read_minutes ?? 5,
    post_type: input.post_type ?? 'guide',
    status: input.status ?? 'draft',
    primary_game_slug: input.primary_game_slug?.trim() || null,
    game_slugs: input.game_slugs ?? [],
    cover_url: input.cover_url?.trim() || null,
    body: (input.body ?? []).filter((p) => p.trim().length > 0),
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
    ...(input.published_at ? { published_at: input.published_at } : {}),
  }
}

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
    body: Array.isArray(row.body) ? row.body.map((b: unknown) => String(b)) : [],
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    published_at: row.published_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}
