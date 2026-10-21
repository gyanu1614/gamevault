import { ValueCrossLinks } from '@/components/values/ValueCrossLinks'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { rarityMeta } from '@/lib/values/rarity'
import { boxForItem } from '@/lib/values/boxes'
import { getValueItemHistory, trendValue, type ValueItem } from '@/lib/values/data'
import { itemFactsGame } from '@/lib/values/item-facts-config'
import { priceHistorySummary } from '@/lib/values/history-summary'
import type { ValueHowToGet } from '@/lib/values/how-to-get'
import { parseImageAttribution, valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'
import { ValueListAboutStats, ValueListItemHero, ValueListPriceTrend, type ItemForm } from './ValueListItemClient'
import { ItemHowToGet } from '@/components/values/how-to-get/ItemHowToGet'
import { ValueItemRails } from '@/components/buy-rails/ValueItemRails'
import { formatUsd, type ItemCopyInput } from './valueListItemCopy'
import { factRows, releasedLabel } from '@/lib/values/item-facts'
import { ValueListFormTable, type FormRow } from './ValueListFormTable'
import { pointsOf, tradeCopy } from './valueListTrade'

/**
 * The streamed body of a value-list item page (Murder Mystery 2): hero, buy
 * rails, worth, How To Get, Standard vs Chroma, price trend, similar items,
 * FAQ and the buy CTA. The page renders the shell and the H1, then this
 * inside a Suspense boundary (ValueListItemSkeleton is its fallback).
 */

const plural = (noun: string) => (noun === 'Knife' ? 'Knives' : `${noun}s`)

export default async function ValueListItemBody({
  gameSlug,
  item,
  items,
  counterpart,
  isChroma,
  typeLabel,
  copy,
  faq,
  howToGet,
  sellHref,
}: {
  gameSlug: string
  item: ValueItem
  items: ValueItem[]
  counterpart: ValueItem | null
  /** This item is the Chroma form (counterpart = its base). */
  isChroma: boolean
  typeLabel: string
  copy: ItemCopyInput
  faq: { q: string; a: string }[]
  howToGet: ValueHowToGet | null
  sellHref: string
}) {
  const theme = getGameContentTheme(gameSlug)
  const hub = valueListHub(gameSlug)!
  const rarity = rarityMeta(gameSlug, item.rarity)
  const hasPage = (i: ValueItem) => valueItemHasPage(gameSlug, { rarity: i.rarity, priced: i.price?.cheapestUsd != null })

  const [buyData, history] = await Promise.all([
    // DropMarket's own live stock (Bundle 2): buy buttons + "Available Now".
    getValueItemBuyData(gameSlug, item.slug),
    getValueItemHistory(gameSlug, item.slug, counterpart ? [item.id, counterpart.id] : [item.id]),
  ])
  const buy = {
    gameSlug,
    itemSlug: item.slug,
    categorySlug: buyData?.categorySlug ?? 'buy-items',
    stock: buyData?.stock ?? null,
  }

  const price = item.price
  const cheapestUsd = price?.cheapestUsd ?? null
  const marketUsd = price?.averageUsd ?? null

  // Standard ↔ Chroma, only when the other form has a page to go to.
  const forms: ItemForm[] | null =
    counterpart && hasPage(counterpart)
      ? [isChroma ? counterpart : item, isChroma ? item : counterpart].map((f, idx) => ({
          key: f.slug,
          label: idx === 0 ? 'Standard' : 'Chroma',
          name: f.name,
          href: `/${gameSlug}/values/${f.slug}`,
          priceUsd: f.price?.cheapestUsd ?? null,
          color: rarityMeta(gameSlug, f.rarity).color,
          current: f.id === item.id,
        }))
      : null

  const stats: { label: string; value: string; color?: string }[] = []
  if (item.rarity) stats.push({ label: 'Rarity', value: rarity.label, color: rarity.color })
  stats.push({ label: 'Type', value: typeLabel })
  // The shared fact rows (Released, Origin), from the catalogue row.
  stats.push(...factRows({ released: releasedLabel({ year: item.releaseYear }), origin: item.origin, howToGet: null }))
  const trade = tradeCopy(gameSlug, items, item)
  if (trade) stats.push({ label: 'Trade Value', value: trade.isBenchmark ? `${trade.points} · The Benchmark` : `${trade.points} · ${trade.inBenchmark}` })
  stats.push({ label: 'Sold By', value: 'Professional Sellers' })

  const series = [item, ...(counterpart ? [counterpart] : [])].map((f) => ({
    key: f.slug,
    name: f.name,
    color: rarityMeta(gameSlug, f.rarity).color,
    points: (history[f.id] ?? [])
      .map((p) => ({ date: p.date, value: trendValue(p) }))
      .filter((p): p is { date: string; value: number } => p.value != null),
  }))

  // The chart is browser-only; this line puts its numbers in the HTML.
  const historyLine = priceHistorySummary(item.name, series[0]?.points.map((p) => ({ date: p.date, price: p.value })))

  // Siblings: same rarity with a page, the same type first, then by price
  // proximity — a $4 Godly sits next to other ~$4 Godlies.
  const ref = cheapestUsd ?? 1
  const similar = items
    .filter((i) => i.id !== item.id && i.rarity === item.rarity && hasPage(i))
    .sort((a, b) => {
      const ta = a.itemType === item.itemType ? 0 : 1
      const tb = b.itemType === item.itemType ? 0 : 1
      if (ta !== tb) return ta - tb
      const da = Math.abs(Math.log((a.price!.cheapestUsd ?? ref) / ref))
      const db = Math.abs(Math.log((b.price!.cheapestUsd ?? ref) / ref))
      return da - db
    })
    .slice(0, 14)
  const allSameType = similar.length > 0 && similar.every((s) => s.itemType === item.itemType)
  const similarTitle = `Similar ${rarity.label || ''} ${allSameType ? plural(typeLabel) : theme.itemNounPlural}`.replace(/\s+/g, ' ')

  const imageCredit = parseImageAttribution(item.imageAttribution)

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <ValueListItemHero
          name={item.name}
          accent={rarity.color}
          imageUrl={item.imageUrl}
          imageAlt={`${item.name} — ${theme.name} ${typeLabel.toLowerCase()}`}
          imageCredit={imageCredit}
          stats={stats}
          cheapestUsd={cheapestUsd}
          marketUsd={marketUsd}
          priceChangedAt={copy.priceChangedAt}
          buy={buy}
          // Not "Sell <name> For Cash": long MM2 names ("Chroma Traveler's
          // Gun") overflow the 260px price column.
          sell={{ href: sellHref, label: 'Sell Yours For Cash' }}
          forms={forms}
        />
      </div>

      <ValueItemRails gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} imageUrl={item.imageUrl ?? null}>
      <AvailableNow
        gameSlug={gameSlug}
        gameName={theme.name}
        categorySlug={buy.categorySlug}
        itemSlug={item.slug}
        itemName={item.name}
        offers={buyData?.offers ?? []}
        total={buyData?.stock?.total ?? 0}
        sellHref={sellHref}
      />

      <div className="relative mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section aria-labelledby="item-worth-title">
          <h2 id="item-worth-title" className="mb-5 text-heading font-bold tracking-tight text-text-primary">
            How Much Is {item.name} Worth in {hub.shortName}?
          </h2>
          <ValueListAboutStats
            name={item.name}
            cheapestUsd={cheapestUsd}
            marketUsd={marketUsd}
            confidence={price?.confidenceLabel ?? null}
            buy={buy}
          />
        </section>

        <ItemHowToGet
          itemName={item.name}
          game={itemFactsGame(gameSlug)}
          imageUrl={item.imageUrl}
          accent={rarity.color}
          howToGet={howToGet}
          cheapestUsd={cheapestUsd}
          buy={buy}
          freeGuideHref={hasHubPage(gameSlug, 'freeItems') ? `/${gameSlug}/free-items` : null}
          boxLink={boxLinkFor(gameSlug, item.slug)}
        />

        {forms && (
          <ValueListFormTable
            name={(isChroma ? counterpart! : item).name}
            rows={[isChroma ? counterpart! : item, isChroma ? item : counterpart!].map((f, idx): FormRow => ({
              key: f.slug,
              label: idx === 0 ? 'Standard' : 'Chroma',
              name: f.name,
              href: `/${gameSlug}/values/${f.slug}`,
              color: rarityMeta(gameSlug, f.rarity).color,
              current: f.id === item.id,
              cheapestUsd: f.price?.cheapestUsd ?? null,
              marketUsd: f.price?.averageUsd ?? null,
              tradePoints: pointsOf(gameSlug, items, f),
              offers: f.price?.sampleSize ?? 0,
            }))}
          />
        )}

        <ValueListPriceTrend series={series} selectedKey={item.slug} />
        {/* What the browser-only chart shows, as text crawlers can read. */}
        {historyLine && <p className="-mt-6 text-meta leading-6 text-text-tertiary">{historyLine}</p>}

        {similar.length > 0 && (
          <SimilarItemsRail
            title={similarTitle}
            seeAllHref={`/${gameSlug}/values`}
            itemNoun={theme.itemNounPlural.toLowerCase()}
            className="border-t border-white/[0.07] pt-10"
            items={similar.map((s) => ({
              key: s.slug,
              href: `/${gameSlug}/values/${s.slug}`,
              name: s.name,
              imageSrc: s.imageUrl,
              imageAlt: `${s.name} — ${theme.name}`,
              price: s.price?.cheapestUsd != null ? formatUsd(s.price.cheapestUsd) : 'Price pending',
            }))}
          />
        )}

        <HubFaqSection
          title="Frequently Asked Questions"
          items={faq}
        />

        <ValueCrossLinks
          ariaLabel={`More ${theme.name} values`}
          back={{ href: `/${gameSlug}/values`, label: `All ${hub.shortName} Values`, short: 'All Values' }}
          method={{ href: `/${gameSlug}/values/methodology`, label: 'How We Value Items', short: 'Our Method' }}
        />

        <HubBuyCta
          gameName={theme.name}
          gameSlug={gameSlug}
          buyHref={itemBuyHref({ gameSlug, categorySlug: buy.categorySlug, itemSlug: item.slug })}
          title={`Get ${item.name} without the grind`}
          ctaLabel={`See ${item.name} Offers`}
        />
      </div>
      </ValueItemRails>
    </>
  )
}

/** How To Get → the box an item drops from (a Shop box first), when the game publishes Box Odds. */
function boxLinkFor(gameSlug: string, itemSlug: string): { href: string; label: string } | null {
  const box = hasHubPage(gameSlug, 'boxes') ? boxForItem(gameSlug, itemSlug) : null
  return box ? { href: `/${gameSlug}/boxes/${box.slug}`, label: `${box.name} Drop Rates` } : null
}
