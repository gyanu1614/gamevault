import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createValueListReadClient } from '@/lib/values/read-client'
import { hasHubPage } from '@/lib/content/theme'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { getValueItems } from '@/lib/values/data'
import { bindValueItemPriceTag, bindValuesTag } from '@/lib/values/revalidation'
import { seoMeta } from '@/lib/seo/fit'
import AdoptMePetPage from './_AdoptMePetPage'
import { getAdoptMePet, getPublishablePetSlugs } from './_adoptMePetData'
import GenericValueItemPage from '../_generic/ValueItemPage'
import ValueListItemPage from '../_generic/ValueListItemPage'
import SabItemPage from './_SabItemPage'
import { SAB_GAME, getBrainrot } from './_sabItemData'
import { generateItemMetadata, type ItemPageProps } from './_itemMetadata'

/**
 * The page SHELL is static content — an item's name, rarity, artwork, income
 * and copy change when the catalogue is edited, not on a price crawl. Only the
 * price block moves, and it moves on its own tag.
 *
 * So the time-based window is a long safety net (7 days), not the refresh
 * path. The refresh is event-driven:
 *   • prices  → `price:<game>:<item>`, revalidated by the crawl's publish step
 *               for the items whose prices actually moved
 *               (/api/internal/sab-market-revalidate)
 *   • content → `values:<game>`, revalidated by /api/internal/values-revalidate
 *
 * Before this, the 24 h window plus a whole-game tag on every one of 8 daily
 * crawls rebuilt all ~500 item pages whether or not anything changed — ~80% of
 * the monthly ISR budget (build audit 2026-09-22, §4).
 */
export const revalidate = 604800

/*
 * Games served by the generic values_* pipeline: VALUES_PIPELINE_GAMES (shared
 * with the listing matcher). A value-LIST hub (valueListHub: Murder Mystery 2)
 * publishes pages only for its high-tier priced items (valueItemHasPage);
 * Steal an Egg publishes every item.
 */

/**
 * Prerender EVERY item page at build time (Step 7a). The set used to be
 * capped at 100 per game because building ~500 pages against the remote DB
 * intermittently tripped Next's 60 s per-page static-generation timeout; the
 * cap left the other ~360 pages to render on first visit after every deploy,
 * at ~12 deploys a day. `staticPageGenerationTimeout` in next.config.js is
 * raised instead. Unknown slugs still 404 through the gates below
 * (dynamicParams stays true: a slug published between deploys renders on
 * demand into the same cache).
 */
export async function generateStaticParams() {
  const supabase = createValueListReadClient(SAB_GAME)
  const [{ data: brainrots }, petSlugs] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select('slug')
      .order('market_value_usd', { ascending: false, nullsFirst: false }),
    getPublishablePetSlugs(),
  ])
  // Generic-pipeline games: prerender the PRICED items (the pages that can
  // rank). Every item has a page (2026-10-21); the unpriced ones render on
  // their first visit into the same ISR cache — building ~850 unpriced MM2
  // pages on every release would cost build minutes and production reads.
  const pipelineParams: Array<{ gameSlug: string; itemSlug: string }> = []
  for (const slug of VALUES_PIPELINE_GAMES) {
    if (!hasHubPage(slug, 'values')) continue
    const items = await getValueItems(slug)
    pipelineParams.push(
      ...items
        .filter((i) => i.price?.cheapestUsd != null)
        .filter((i) => valueItemHasPage(slug, { rarity: i.rarity, priced: true }))
        .map((i) => ({ gameSlug: slug, itemSlug: i.slug })),
    )
  }

  return [
    ...pipelineParams,
    ...(((brainrots ?? []) as { slug: string }[]).map((r) => ({
      gameSlug: 'steal-a-brainrot',
      itemSlug: r.slug,
    }))),
    ...petSlugs.map((slug) => ({ gameSlug: 'adopt-me', itemSlug: slug })),
  ]
}

export default async function ValueItemRoute({ params }: ItemPageProps) {
  const { gameSlug, itemSlug } = await params
  // Two tags, two lifetimes (see `revalidate` above):
  //   • `values:<game>`      — catalogue/content edits, whole game.
  //   • `price:<game>:<item>` — this item's prices, moved by a crawl only when
  //     the published numbers actually changed.
  // Both are bound before any branch so every variant of this page carries
  // them, and the prices below stay SERVER-rendered (they are in the HTML for
  // crawlers — the tags change when the page is rebuilt, not how).
  await Promise.all([
    bindValuesTag(gameSlug),
    bindValueItemPriceTag(gameSlug, itemSlug),
  ])

  // Adopt Me per-pet page — every active pet renders; anything
  // thin or unpriced 404s rather than shipping an empty page.
  if (gameSlug === 'adopt-me') {
    const pet = await getAdoptMePet(itemSlug)
    if (!pet) notFound()
    return <AdoptMePetPage pet={pet} />
  }

  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    if (!hasHubPage(gameSlug, 'values')) notFound()
    if (valueListHub(gameSlug)) {
      // Gate BEFORE anything streams: an enabled item has a page (every one,
      // 2026-10-21); a slug the catalogue does not know is a real 404.
      const items = await getValueItems(gameSlug, { itemSlug })
      const item = items.find((i) => i.slug === itemSlug)
      if (!item || !valueItemHasPage(gameSlug, { rarity: item.rarity, priced: item.price?.cheapestUsd != null })) {
        notFound()
      }
      return <ValueListItemPage gameSlug={gameSlug} item={item} items={items} />
    }
    return <GenericValueItemPage gameSlug={gameSlug} itemSlug={itemSlug} />
  }

  if (!hasHubPage(gameSlug, 'values')) notFound()

  const brainrot = await getBrainrot(itemSlug)
  if (!brainrot) notFound()

  return <SabItemPage gameSlug={gameSlug} brainrot={brainrot} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(props: ItemPageProps): Promise<Metadata> {
  return seoMeta(await generateItemMetadata(props))
}
