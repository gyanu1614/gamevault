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
 *
 * Every read here is filtered to status = 'published', i.e. strictly public,
 * so they use the cookie-free anon client. That is what lets the blog routes
 * honour their `revalidate` instead of being forced dynamic by cookies().
 * Drafts are read by the admin surfaces through the session/service client.
 */

import 'server-only'
import { createAnonClient } from '@/lib/supabase/anon'
import type { BlogPost } from './posts'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { BLOG_CODES_GAMES_TAG } from '@/lib/revalidation/tags'

export type BlogPostType = 'guide' | 'value' | 'seller' | 'codes'

/** Full DB post — the file BlogPost shape plus the CMS/nesting fields. */
export interface DbBlogPost extends BlogPost {
  id: string
  postType: BlogPostType
  primaryGameSlug: string | null
  seoTitle: string | null
  seoDescription: string | null
  /**
   * Last-modified date (YYYY-MM-DD). Kept fresh by the blog_posts_touch_updated_at
   * trigger. Powers the article's schema.org `dateModified` and the visible
   * "Updated" byline. Equals publishedAt for a post that has never been edited.
   */
  updatedAt: string
  /** The stored body as is (legacy string[] or `{ v: 2, doc, cover }`) — read it with readBody(). */
  rawBody: unknown
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
  updated_at: string
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
    // Fall back to publishedAt when updated_at is somehow absent, so a post
    // never reports being modified before it was published.
    updatedAt: (row.updated_at ?? row.published_at ?? '').slice(0, 10),
    games: row.game_slugs ?? [],
    cover: row.cover_url,
    body,
    postType: row.post_type,
    primaryGameSlug: row.primary_game_slug,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    rawBody: row.body ?? null,
  }
}

const SELECT =
  'id,slug,title,excerpt,author,read_minutes,post_type,status,primary_game_slug,game_slugs,cover_url,body,seo_title,seo_description,published_at,updated_at'
/**
 * Lists (hubs, /blog, rails, static params) never read `body`: it is the
 * whole post, and every hub render downloaded every post's full text.
 */
const LIST_SELECT =
  'id,slug,title,excerpt,author,read_minutes,post_type,status,primary_game_slug,game_slugs,cover_url,seo_title,seo_description,published_at,updated_at'

/** All published posts scoped to a game (its nested /[game]/blog collection). */
export async function getGamePosts(gameSlug: string): Promise<DbBlogPost[]> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(LIST_SELECT)
    .eq('primary_game_slug', gameSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}

/** A single published post by game + slug (the nested article URL). */
// STATE-004 — called from generateMetadata and the page body; cache() makes
// the two runs of one request share a single query.
export const getGamePost = cache(async function getGamePost(
  gameSlug: string,
  slug: string,
): Promise<DbBlogPost | null> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('primary_game_slug', gameSlug)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error || !data) return null
  return rowToPost(data as unknown as BlogPostRow)
})

/** A game's one published codes post (Blog v2) — shown at /{game}/codes. */
export const getGameCodesPost = cache(async function getGameCodesPost(gameSlug: string): Promise<DbBlogPost | null> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('primary_game_slug', gameSlug)
    .eq('post_type', 'codes')
    .eq('status', 'published')
    .maybeSingle()
  if (error || !data) return null
  return rowToPost(data as unknown as BlogPostRow)
})

/**
 * The games with a published codes post — the hub nav's Codes menu reads it on
 * every hub page, so it is cached under BLOG_CODES_GAMES_TAG (saveBlogPost
 * refreshes it). [] on error: the menu then simply lists fewer games.
 */
export const getCodesPostGameSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const { data, error } = await createAnonClient()
      .from('blog_posts')
      .select('primary_game_slug')
      .eq('post_type', 'codes')
      .eq('status', 'published')
      .not('primary_game_slug', 'is', null)
    if (error || !data) return []
    return [...new Set((data as Array<{ primary_game_slug: string }>).map((r) => r.primary_game_slug))]
  },
  ['blog-codes-post-games'],
  { tags: [BLOG_CODES_GAMES_TAG], revalidate: 86400 },
)

/**
 * Game-relevant rail: published posts tagged for the game (via game_slugs),
 * newest first. Used by listing pages / cross-surfacing. Empty array on any
 * error so a rail never breaks a page.
 */
export async function getPostsTaggedForGame(
  gameSlug: string,
  limit = 4,
): Promise<DbBlogPost[]> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .contains('game_slugs', [gameSlug])
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}

/** All published posts (site-wide /blog index), newest first. */
export async function getAllPublishedPosts(): Promise<DbBlogPost[]> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as BlogPostRow[]).map(rowToPost)
}

/**
 * The published post with this slug under ANY game — or that had this slug
 * before a rename — for the moved-post redirect: /{oldGame}/blog/{slug}
 * after an admin moved it to another game, /{game}/blog/{oldSlug} after a
 * rename.
 */
export const getPublishedPostBySlugAnyGame = cache(async function getPublishedPostBySlugAnyGame(
  slug: string,
): Promise<{ slug: string; primaryGameSlug: string | null } | null> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug,primary_game_slug')
    .eq('slug', slug)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
  let row = (data as Array<{ slug: string; primary_game_slug: string | null }> | null)?.[0]
  if (error) return null
  if (!row) {
    // Renamed: a live post remembers the URLs it had (body.oldSlugs).
    const { data: renamed } = await supabase
      .from('blog_posts')
      .select('slug,primary_game_slug')
      .contains('body', { oldSlugs: [slug] })
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
    row = (renamed as Array<{ slug: string; primary_game_slug: string | null }> | null)?.[0]
  }
  if (!row) return null
  return { slug: row.slug, primaryGameSlug: row.primary_game_slug }
})
