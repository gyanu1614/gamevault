/**
 * /[game]/blog/[slug] — one guide (layout: ./_article.tsx, shared with the
 * game's /codes page). Moved or renamed posts 301 to their new address; a
 * codes post 301s to /{game}/codes, its one canonical page (Blog v2).
 */

import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getGamePost, getAllPublishedPosts, getPublishedPostBySlugAnyGame } from '@/lib/blog/db'
import { movedPostTarget, postHref } from '@/lib/blog/post-url'
import { getBlogHubGameSlugs, isBlogHubGame } from '@/lib/blog/hub-params'
import { seoMeta } from '@/lib/seo/fit'
import { ArticleView, articleMetadata, getArticleGame } from './_article'

export const revalidate = 3600

/** Prerender every published game guide; new ones render on demand into the same cache. Codes posts live at /{game}/codes. */
export async function generateStaticParams() {
  const posts = await getAllPublishedPosts()
  return posts
    .filter((p) => p.primaryGameSlug && p.postType !== 'codes')
    .map((p) => ({ gameSlug: p.primaryGameSlug as string, slug: p.slug }))
}

/**
 * A post moved to another game in admin (e.g. MM2 Halloween from Adopt Me to
 * MM2), or renamed: its old URL answers with a permanent redirect to the new
 * one, so links and search rankings follow. No per-move config.
 */
async function redirectIfMoved(gameSlug: string, slug: string): Promise<void> {
  const target = movedPostTarget(await getPublishedPostBySlugAnyGame(slug), gameSlug, slug)
  if (target) permanentRedirect(target)
}

async function generateMetadataRaw({ params }: { params: Promise<{ gameSlug: string; slug: string }> }): Promise<Metadata> {
  const { gameSlug, slug } = await params
  if (!isBlogHubGame(gameSlug, await getBlogHubGameSlugs())) notFound()
  const post = await getGamePost(gameSlug, slug)
  if (!post) {
    await redirectIfMoved(gameSlug, slug)
    notFound()
  }
  if (post.postType === 'codes') permanentRedirect(postHref(post))
  return articleMetadata(post, `/${gameSlug}/blog/${slug}`)
}

export default async function GameBlogArticle({ params }: { params: Promise<{ gameSlug: string; slug: string }> }) {
  const { gameSlug, slug } = await params
  // A game switched off in admin has no guides (Blog v2) — decided before the fan-out.
  if (!isBlogHubGame(gameSlug, await getBlogHubGameSlugs())) notFound()
  const [game, post] = await Promise.all([getArticleGame(gameSlug), getGamePost(gameSlug, slug)])
  if (!post) await redirectIfMoved(gameSlug, slug)
  if (!game || !post) notFound()
  // A codes post's one page is /{game}/codes.
  if (post.postType === 'codes') permanentRedirect(postHref(post))
  return <ArticleView gameSlug={gameSlug} game={game} post={post} path={`/${gameSlug}/blog/${slug}`} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(...args: Parameters<typeof generateMetadataRaw>): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
