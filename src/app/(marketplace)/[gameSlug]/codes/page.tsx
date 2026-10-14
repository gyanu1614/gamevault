import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { getFreeGuide } from '@/lib/values/free-guide'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { getCodesPostGameSlugs, getGameCodesPost } from '@/lib/blog/db'
import { getBlogHubGameSlugs, isBlogHubGame } from '@/lib/blog/hub-params'
import CodesPage, { codesCopyCtx } from './_CodesPage'
import { codesFacts, metaDescription, metaTitle } from './_codesCopy'
import { ArticleView, articleMetadata, getArticleGame } from '../blog/[slug]/_article'
import { seoMeta } from '@/lib/seo/fit'

/**
 * /[game]/codes — the game's one codes page (Blog v2, 2026-10-13):
 *  - MM2: its own data page (every code and whether any works; theme `codes`).
 *    Static: the facts are build-time (the researched seed; the weekly watch
 *    job flags when it needs a re-check).
 *  - every other game with a content hub: its published Codes post, drawn by
 *    the shared article view, at this canonical address. saveBlogPost
 *    refreshes the page; the 24 h window is the safety net.
 */
export const revalidate = 86400
/**
 * Closed set: the theme codes games plus the switched-on games with a live
 * codes post, at build time. Not enforced on Vercel (a codes post published
 * later renders on demand) — the body decides, so a slug outside the rule 404s.
 */
export const dynamicParams = false

export async function generateStaticParams() {
  const [hubs, postGames] = await Promise.all([getBlogHubGameSlugs(), getCodesPostGameSlugs()])
  const slugs = new Set([...contentHubSlugsFor('codes'), ...postGames.filter((s) => isBlogHubGame(s, hubs))])
  return [...slugs].map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

/** The codes post for a game that has a content hub and no codes page of its own, else null. */
async function codesPost(gameSlug: string) {
  if (hasHubPage(gameSlug, 'codes')) return null
  if (!isBlogHubGame(gameSlug, await getBlogHubGameSlugs())) return null
  return getGameCodesPost(gameSlug)
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const path = `/${gameSlug}/codes`
  const guide = hasHubPage(gameSlug, 'codes') ? getFreeGuide(gameSlug) : null
  if (guide) {
    const ctx = codesCopyCtx(gameSlug)
    const f = codesFacts(guide)
    const title = metaTitle(ctx, f)
    const description = metaDescription(ctx, f)
    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'article' },
    }
  }
  const post = await codesPost(gameSlug)
  if (!post) notFound()
  return articleMetadata(post, path)
}

export default async function CodesRoute({ params }: PageProps) {
  const { gameSlug } = await params
  if (hasHubPage(gameSlug, 'codes')) {
    // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
    if (!getFreeGuide(gameSlug)) notFound()
    return <CodesPage gameSlug={gameSlug} />
  }
  const [post, game] = await Promise.all([codesPost(gameSlug), getArticleGame(gameSlug)])
  if (!post || !game) notFound()
  return <ArticleView gameSlug={gameSlug} game={game} post={post} path={`/${gameSlug}/codes`} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
