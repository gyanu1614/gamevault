/**
 * /[game]/blog/feed — RSS 2.0 feed of a game's published blog posts.
 *
 * Generic: works for any game with published posts. Reads the same DB source as
 * the blog index (getGamePosts), newest first. A game with no game row 404s; a
 * game with no posts returns an empty but valid feed.
 *
 * Cached at the edge for an hour, matching the blog index's revalidate.
 */

import { createClient } from '@/lib/supabase/server'
import { getGamePosts } from '@/lib/blog/db'
import { SITE_URL, SITE_NAME } from '@/config/site'

export const revalidate = 3600

/** XML-escape a text node / attribute value. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameSlug: string }> },
) {
  const { gameSlug } = await params

  const supabase = await createClient()
  const { data: game } = await (supabase as any)
    .from('games')
    .select('name, slug, is_active')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!game) {
    return new Response('Not found', { status: 404 })
  }

  const posts = await getGamePosts(gameSlug)

  const feedUrl = `${SITE_URL}/${gameSlug}/blog/feed`
  const blogUrl = `${SITE_URL}/${gameSlug}/blog`
  const title = `${game.name} Guides & Values — ${SITE_NAME}`
  const description = `Value lists, trading guides and selling tips for ${game.name}, from ${SITE_NAME}.`

  // Feed-level date is the newest post's date (or now-less: omit if no posts).
  const lastBuild = posts[0]?.publishedAt
    ? new Date(posts[0].publishedAt).toUTCString()
    : ''

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${gameSlug}/blog/${post.slug}`
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : ''
      return [
        '    <item>',
        `      <title>${esc(post.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        post.excerpt ? `      <description>${esc(post.excerpt)}</description>` : '',
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : '',
        `      <dc:creator>${esc(post.author)}</dc:creator>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${esc(title)}</title>`,
    `    <link>${esc(blogUrl)}</link>`,
    `    <description>${esc(description)}</description>`,
    '    <language>en-gb</language>',
    `    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />`,
    lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>` : '',
    items,
    '  </channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
