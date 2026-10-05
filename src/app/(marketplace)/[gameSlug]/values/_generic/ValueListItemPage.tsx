import { Suspense } from 'react'
import Link from '@/components/navigation/AppLink'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { JsonLd, breadcrumbList, faqPage, productAggregate } from '@/lib/seo/jsonld'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { getGameContentTheme } from '@/lib/content/theme'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { rarityMeta } from '@/lib/values/rarity'
import { getValueItemHistory, trendValue, type ValueItem } from '@/lib/values/data'
import { parseImageAttribution, valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'
import {
  ValueListAboutStats,
  ValueListItemHero,
  ValueListPriceTrend,
  type ItemForm,
} from './ValueListItemClient'
import { ValueItemHowToGet } from './ValueItemHowToGet'
import { ValueListItemSkeleton } from './ValueListItemSkeleton'
import { aboutSentence, chromaSentence, formatUsd, itemFaq, priceSentence, type ItemCopyInput } from './valueListItemCopy'

/**
 * Value page for one high-tier item on a value-list hub (Murder Mystery 2:
 * Godly / Ancient / Vintage / Unique / Chroma with a price — the route gates
 * on valueItemHasPage before this renders, so a 404 is a real 404).
 *
 * Section for section the Adopt Me pet page: backdrop + nav, breadcrumb, H1,
 * hero (price, buy/sell, Standard ↔ Chroma switch), Available Now, About
 * (answer-first callout + stats), How To Get (seam), price trend, similar
 * items rail, FAQ, cross-links, buy CTA. One price per item — a Chroma is its
 * own item — so there is no variant context.
 */

const plural = (noun: string) => (noun === 'Knife' ? 'Knives' : `${noun}s`)

export default async function ValueListItemPage({
  gameSlug,
  item,
  items,
}: {
  gameSlug: string
  item: ValueItem
  /** Every item of the game, read under THIS item's tags (the route's gate read). */
  items: ValueItem[]
}) {
  const theme = getGameContentTheme(gameSlug)
  const hub = valueListHub(gameSlug)!
  const hubNav = await getHubNavData(gameSlug)

  const rarity = rarityMeta(gameSlug, item.rarity)
  const typeLabel = (item.itemType && hub.itemTypeLabels[item.itemType]) || theme.itemNoun
  const hasPage = (i: ValueItem) => valueItemHasPage(gameSlug, { rarity: i.rarity, priced: i.price?.cheapestUsd != null })

  // The other form: a Chroma's base, or this item's Chroma.
  const base = item.baseItemId ? items.find((i) => i.id === item.baseItemId) ?? null : null
  const chroma = base ? null : items.find((i) => i.baseItemId === item.id) ?? null
  const counterpart = base ?? chroma

  const price = item.price
  const cheapestUsd = price?.cheapestUsd ?? null
  const copy: ItemCopyInput = {
    name: item.name,
    gameName: theme.name,
    shortName: hub.shortName,
    rarity: item.rarity,
    typeNoun: typeLabel.toLowerCase(),
    releaseYear: item.releaseYear,
    origin: item.origin,
    obtain: item.obtain,
    cheapestUsd,
    marketUsd: price?.averageUsd ?? null,
    listedNow: price?.sampleSize ?? 0,
    priceChangedAt: price?.priceChangedAt ?? null,
    counterpart: counterpart
      ? { name: counterpart.name, isChroma: counterpart === chroma, cheapestUsd: counterpart.price?.cheapestUsd ?? null }
      : null,
  }
  const faq = itemFaq(copy)
  const path = `/${gameSlug}/values/${item.slug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Values', path: `/${gameSlug}/values` },
          { name: item.name, path },
        ])}
      />
      <JsonLd data={faqPage(faq)} />
      {/* Product + AggregateOffer: only a real, listing-backed price is an offer. */}
      {cheapestUsd != null && (price?.sampleSize ?? 0) > 0 && (
        <JsonLd
          data={productAggregate({
            name: `${item.name} — ${theme.name}`,
            description: priceSentence(copy) ?? aboutSentence(copy),
            brand: theme.name,
            image: item.imageUrl,
            lowPrice: cheapestUsd,
            highPrice: Math.max(cheapestUsd, price?.highUsd ?? cheapestUsd),
            offerCount: price!.sampleSize,
            url: path,
          })}
        />
      )}

      <GameHeroBackdrop gameSlug={gameSlug} size="tall">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-caption text-text-tertiary">
            <Link href={`/${gameSlug}/values`} className="transition-colors hover:text-text-primary">
              Values
            </Link>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            {/* Plain text: a rarity filter is client state, not a crawlable URL. */}
            {item.rarity && (
              <>
                <span>{rarity.label}</span>
                <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
              </>
            )}
            <span className="truncate text-text-primary">{item.name}</span>
          </nav>

          <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em] text-text-primary sm:text-display">
            {item.name} Value in {hub.shortName}
          </h1>
          <p className="mt-3 max-w-2xl text-body leading-7 text-text-secondary">
            What {item.name} sells for in real money — from live listings by reputable sellers.
          </p>
        </div>

        <Suspense fallback={<ValueListItemSkeleton withForms={!!counterpart && hasPage(counterpart)} />}>
          <ItemBody
            gameSlug={gameSlug}
            item={item}
            items={items}
            counterpart={counterpart}
            isChroma={!!base}
            typeLabel={typeLabel}
            copy={copy}
            faq={faq}
            sellHref={`/${gameSlug}/sell?src=${gameSlug}-item-page`}
          />
        </Suspense>
      </GameHeroBackdrop>

      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}

async function ItemBody({
  gameSlug,
  item,
  items,
  counterpart,
  isChroma,
  typeLabel,
  copy,
  faq,
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
  const listedNow = price?.sampleSize ?? 0

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
  if (item.origin) stats.push({ label: 'Origin', value: item.origin })
  if (item.releaseYear) stats.push({ label: 'Released', value: String(item.releaseYear) })
  stats.push({ label: 'Listed Now', value: listedNow > 0 ? listedNow.toLocaleString('en-US') : 'None' })

  const series = [item, ...(counterpart ? [counterpart] : [])].map((f) => ({
    key: f.slug,
    name: f.name,
    color: rarityMeta(gameSlug, f.rarity).color,
    points: (history[f.id] ?? [])
      .map((p) => ({ date: p.date, value: trendValue(p) }))
      .filter((p): p is { date: string; value: number } => p.value != null),
  }))

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
  const chromaLine = chromaSentence(copy)

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <ValueListItemHero
          name={item.name}
          eyebrow={`${item.rarity ? `${rarity.label} ` : ''}${typeLabel}`}
          accent={rarity.color}
          imageUrl={item.imageUrl}
          imageAlt={`${item.name} — ${theme.name} ${typeLabel.toLowerCase()}`}
          imageCredit={imageCredit}
          stats={stats}
          cheapestUsd={cheapestUsd}
          marketUsd={marketUsd}
          priceChangedAt={price?.priceChangedAt ?? null}
          buy={buy}
          // Not "Sell <name> For Cash": long MM2 names ("Chroma Traveler's
          // Gun") overflow the 260px price column.
          sell={{ href: sellHref, label: 'Sell Yours For Cash' }}
          forms={forms}
        />
      </div>

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
        <section>
          <h2 className="mb-5 text-heading font-bold tracking-tight text-text-primary">About The {item.name}</h2>
          <ValueListAboutStats
            name={item.name}
            cheapestUsd={cheapestUsd}
            marketUsd={marketUsd}
            listedNow={listedNow}
            confidence={price?.confidenceLabel ?? null}
            buy={buy}
          />
          {/* Answer-first, dated, quotable — plain server text for crawlers. */}
          <p className="mt-6 text-body leading-7 text-text-secondary">
            {aboutSentence(copy)} {chromaLine ? `${chromaLine} ` : ''}
            {priceSentence(copy)}
          </p>
        </section>

        <ValueItemHowToGet itemName={item.name} obtain={item.obtain} />

        <ValueListPriceTrend series={series} selectedKey={item.slug} />

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
          subtitle={`Everything about the ${item.name}'s value and how to buy or sell it.`}
          items={faq}
        />

        <nav aria-label={`More ${theme.name} values`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href={`/${gameSlug}/values`}
            className={`${VALUE_SURFACE_LINK} group flex items-center gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <CaretLeftIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:-translate-x-0.5 group-hover:text-text-primary" />
            <span>
              <span className={`block ${VALUE_LABEL}`}>Back to</span>
              <span className="block text-body-sm font-semibold text-text-primary">All {hub.shortName} Values</span>
            </span>
          </Link>
          <Link
            href={`/${gameSlug}/values/methodology`}
            className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <span>
              <span className={`block ${VALUE_LABEL}`}>Our Method</span>
              <span className="block text-body-sm font-semibold text-text-primary">How We Value Items</span>
            </span>
            <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
          </Link>
        </nav>

        <HubBuyCta
          gameName={theme.name}
          gameSlug={gameSlug}
          buyHref={itemBuyHref({ gameSlug, categorySlug: buy.categorySlug, itemSlug: item.slug })}
        />
      </div>
    </>
  )
}
