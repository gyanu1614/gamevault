/**
 * Database-backed blog data layer.
 *
 * Reads published posts from the `blog_posts` table (see migration
 * 20260727000000_blog_posts_cms.sql). This is the CMS-swap the file-based
 * `posts.ts` was designed for — same `BlogPost` shape, now editable from the
 * admin panel and scoped to nested per-game URLs (/[game]/blog/[slug]).
 *
 * These are async (DB round-trips); the file-based helpers in posts.ts stay as
 * the seed/import source and a synchronous fallback for any surface not yet
 * migrated.
 */

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BlogPost } from './posts'

export type BlogPostType = 'guide' | 'value' | 'seller'

/** Full DB post — the file BlogPost shape plus the CMS/nesting fields. */
export interface DbBlogPost extends BlogPost {
  id: string
  postType: BlogPostType
  primaryGameSlug: string | null
  seoTitle: string | null
  seoDescription: string | null
}

interface BlogPostRow {
  id: string
  slug: string
  title: string
  excerpt: string
  author: string
  read_minutes: number
  post_type: BlogPostType
  status: string
  primary_game_slug: string | null
  game_slugs: string[] | null
  cover_url: string | null
  body: unknown
  seo_title: string | null
  seo_description: string | null
  published_at: string
}

function rowToPost(row: BlogPostRow): DbBlogPost {
  const body = Array.isArray(row.body)
    ? (row.body as unknown[]).map((b) => String(b))
    : []
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? '',
    author: row.author ?? 'DropMarket Team',
    readMinutes: row.read_minutes ?? 5,
    // Keep the ISO date shape the file-based BlogPost uses (YYYY-MM-DD).
    publishedAt: (row.published_at ?? '').slice(0, 10),
    games: row.game_slugs ?? [],
    cover: row.cover_url,
    body,
    postType: row.post_type,
    primaryGameSlug: row.primary_game_slug,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  }
}

const SELECT =
  'id,slug,title,excerpt,author,read_minutes,post_type,status,primary_game_slug,game_slugs,cover_url,body,seo_title,seo_description,published_at'

/** All published posts scoped to a game (its nested /[game]/blog collection). */
export async function getGamePosts(gameSlug: string): Promise<DbBlogPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('primary_game_slug', gameSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}

/** A single published post by game + slug (the nested article URL). */
export async function getGamePost(
  gameSlug: string,
  slug: string,
): Promise<DbBlogPost | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('primary_game_slug', gameSlug)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error || !data) return null
  return rowToPost(data as unknown as BlogPostRow)
}

/**
 * Game-relevant rail: published posts tagged for the game (via game_slugs),
 * newest first. Used by listing pages / cross-surfacing. Empty array on any
 * error so a rail never breaks a page.
 */
export async function getPostsTaggedForGame(
  gameSlug: string,
  limit = 4,
): Promise<DbBlogPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('status', 'published')
    .contains('game_slugs', [gameSlug])
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}

/** All published posts (site-wide /blog index), newest first. */
export async function getAllPublishedPosts(): Promise<DbBlogPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}
