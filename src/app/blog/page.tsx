/**
 * /blog: the site-wide guide index.
 *
 * Two jobs: route readers into each game's blog home (/[game]/blog), where
 * every post lives, and show what's new across every game. Redesigned
 * 2026-10-15 (owner: the old look): the blog's own wallpaper and fonts (the
 * same as the game blog homes), the new hero, a game switcher, the newest
 * guide featured, then a row of guide cards per game. Data-gated: a game
 * appears only with published posts, and links to its blog home only when
 * that hub is switched on.
 */
import type { Metadata } from 'next'
import { BookOpenTextIcon } from '@phosphor-icons/react/dist/ssr/BookOpenText'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { BlogBackdrop } from '@/components/blog/BlogBackdrop'
import { FeaturedGuide } from '@/components/blog/FeaturedGuide'
import { GUIDE_TYPE_LABEL } from '@/components/blog/GuideCard'
import { InfoCtaBand, InfoHero } from '@/components/info'
import { VALUE_SURFACE } from '@/components/values/styles'
import { SITE_URL } from '@/config/site'
import { getAllPublishedPosts } from '@/lib/blog/db'
import { getBlogHubGameSlugs } from '@/lib/blog/hub-params'
import { postHref } from '@/lib/blog/post-url'
import { blogFont } from '@/lib/fonts/blog'
import { JsonLd, blogCollection, breadcrumbList } from '@/lib/seo/jsonld'
import { seoMeta } from '@/lib/seo/fit'
import { getAllGames } from '@/lib/utils/games'
import { groupGuides } from './_guides'
import { GameSwitch } from './_GameSwitch'
import { GameSection } from './_GameSection'

export const revalidate = 3600

export const metadata: Metadata = seoMeta({
  title: 'Game Trading Guides & Safety Tips',
  description: 'Value guides, trading tips and selling help for Roblox games, plus marketplace safety advice from the DropMarket team.',
  alternates: { canonical: '/blog' },
})

function listSentence(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export default async function BlogIndexPage() {
  const [posts, allGames, hubSlugs] = await Promise.all([getAllPublishedPosts(), getAllGames(), getBlogHubGameSlugs()])
  const games = new Map(allGames.map((g) => [g.slug, { slug: g.slug, name: g.name, imageUrl: g.image_url ?? null }]))
  const { featured, games: gameGroups, sections } = groupGuides(posts, games, hubSlugs)
  const lead = gameGroups.length
    ? `Values, trading tips and selling guides for ${listSentence(gameGroups.map((g) => g.name))}.`
    : 'Values, trading tips and selling guides from the DropMarket team.'

  return (
    // The blog's shared night wallpaper behind everything (`isolate` keeps
    // its -z-10 layer above the ground; BlogBackdrop).
    <main className={`relative isolate min-h-screen bg-bg-base pb-20 ${blogFont.variable}`}>
      <BlogBackdrop />
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/blog' }])} />
      {posts.length > 0 && (
        <JsonLd
          data={blogCollection({
            name: 'DropMarket Guides',
            url: `${SITE_URL}/blog`,
            posts: posts.map((p) => ({ title: p.title, path: postHref(p), datePublished: p.publishedAt, description: p.excerpt })),
          })}
        />
      )}

      <InfoHero icon={BookOpenTextIcon} tone="lime" title="Game Trading Guides" lead={lead} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <GameSwitch games={gameGroups} />

        {featured ? (
          <div className="mt-10 sm:mt-12">
            <FeaturedGuide
              href={postHref(featured)}
              category={GUIDE_TYPE_LABEL[featured.postType] ?? 'Guide'}
              readMinutes={featured.readMinutes}
              title={featured.title}
              excerpt={featured.excerpt}
              publishedAt={featured.publishedAt}
              cover={featured.cover}
            />
          </div>
        ) : (
          <div className={`${VALUE_SURFACE} mt-12 px-6 py-14 text-center`}>
            <p className="text-body font-semibold text-text-primary">No guides yet</p>
            <p className="mt-2 text-body-sm text-text-tertiary">New guides land here as we publish them.</p>
          </div>
        )}

        {sections.map((g) => (
          <GameSection key={g.key} group={g} />
        ))}

        <InfoCtaBand
          icon={ShieldCheckIcon}
          tone="lime"
          title="Ready to Trade?"
          body="Every order on DropMarket is covered by SafeDrop Protection."
          action={{ href: '/browse', label: 'Browse the Marketplace' }}
        />
      </div>
    </main>
  )
}
