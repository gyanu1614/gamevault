import { readValuePageEvidence } from '@/lib/seo/gate/read'
import { ItemPageTitle } from '@/components/values/ItemPageTitle'
import { answerSentence, withAnswer } from '@/components/values/value-answer-format'
import { Suspense } from 'react'
import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { CalendarStarIcon } from '@phosphor-icons/react/dist/ssr/CalendarStar'
import { DiamondIcon } from '@phosphor-icons/react/dist/ssr/Diamond'
import { CalculatorIcon } from '@phosphor-icons/react/dist/ssr/Calculator'
import { JsonLd, breadcrumbList, faqPage, valuePage } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getValueItemEvent } from '@/lib/values/events'
import { HUB_GROUND } from '@/components/values/styles'
import { rarityMeta } from '@/lib/values/rarity'
import { type ValueItem } from '@/lib/values/data'
import { getItemFacts } from '@/lib/values/item-facts-data'
import { itemFactsGame } from '@/lib/values/item-facts-config'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { ValueListItemSkeleton } from './ValueListItemSkeleton'
import { aboutSentence, chromaSentence, itemFaq, priceSentence, type ItemCopyInput } from './valueListItemCopy'
import { howToGetFaqs } from '@/lib/values/how-to-get-copy'
import ValueListItemBody from './ValueListItemBody'
import { tradeCopy } from './valueListTrade'

/**
 * Value page for one high-tier item on a value-list hub (Murder Mystery 2:
 * Godly / Ancient / Vintage / Unique / Chroma with a price — the route gates
 * on valueItemHasPage before this renders, so a 404 is a real 404).
 *
 * Section for section the Adopt Me pet page: backdrop + nav, breadcrumb, H1,
 * hero (price, buy/sell, Standard ↔ Chroma switch), Available Now, About
 * (answer-first callout + stats), How To Get (verified facts), price trend, similar
 * items rail, FAQ, cross-links, buy CTA. One price per item — a Chroma is its
 * own item — so there is no variant context.
 */

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
  const [hubNav, facts, fromEvent, evidence] = await Promise.all([
    getHubNavData(gameSlug),
    // The shared facts (verified how_to_get), under the item's tags.
    getItemFacts(gameSlug, item.slug),
    // The event it came from (values_events), for the link back — item tags too.
    hasHubPage(gameSlug, 'events') ? getValueItemEvent(gameSlug, item.slug) : Promise.resolve(null),
    // The ONE page date: the last material price move (seo_value_evidence) —
    // the "As of" in the copy, the hero, dateModified and the sitemap lastmod.
    readValuePageEvidence(gameSlug, item.slug),
  ])
  const priceMovedAt = evidence?.priceMovedAt ?? null
  const howToGet = facts.howToGet
  const game = itemFactsGame(gameSlug)

  const rarity = rarityMeta(gameSlug, item.rarity)
  const typeLabel = (item.itemType && hub.itemTypeLabels[item.itemType]) || theme.itemNoun

  const hasPage = (i: ValueItem) => valueItemHasPage(gameSlug, { rarity: i.rarity, priced: i.price?.cheapestUsd != null })

  // The other form: a Chroma's base, or this item's Chroma.
  const base = item.baseItemId ? items.find((i) => i.id === item.baseItemId) ?? null : null
  const chroma = base ? null : items.find((i) => i.baseItemId === item.id) ?? null
  const counterpart = base ?? chroma
  // A Chroma links up to the Chroma hub (which links every Chroma page back).
  const chromaHubHref = item.rarity === 'Chroma' && hasHubPage(gameSlug, 'chromas') ? `/${gameSlug}/chromas` : null
  // A priced item drops straight into Inventory Worth: `#i=<slug>:1` is the
  // tool's own hash format; `&add=1` merges it into the visitor's saved list
  // instead of replacing it (a shared link without it shows exactly its list).
  const inventoryHref =
    item.price?.cheapestUsd != null && hasHubPage(gameSlug, 'inventory') ? `/${gameSlug}/inventory#i=${item.slug}:1&add=1` : null

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
    priceChangedAt: priceMovedAt,
    counterpart: counterpart
      ? { name: counterpart.name, isChroma: counterpart === chroma, cheapestUsd: counterpart.price?.cheapestUsd ?? null }
      : null,
    trade: tradeCopy(gameSlug, items, item),
  }
  // One FAQPage per page: the how-to-get answer joins the same list.
  const faq = itemFaq(
    copy,
    howToGet
      ? howToGetFaqs({ name: item.name, gameName: game.gameName, shortName: game.shortName, h: howToGet, cheapestUsd, earnRate: game.earnRate, vocab: game.vocab })
      : [],
  )
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
      <JsonLd
        data={valuePage({
          name: `${item.name} Value in ${hub.shortName}`,
          path,
          description: withAnswer(
            answerSentence({ name: item.name, valueUsd: cheapestUsd, offers: price?.sampleSize ?? 0, updatedAt: priceMovedAt }),
            aboutSentence(copy),
          ),
          dateModified: priceMovedAt,
          item:
            cheapestUsd != null
              ? {
                  name: item.name,
                  values: [
                    { label: 'Cheapest price', valueUsd: cheapestUsd, offers: price?.sampleSize ?? undefined },
                    ...(price?.averageUsd != null ? [{ label: 'Typical price', valueUsd: price.averageUsd }] : []),
                    ...(counterpart?.price?.cheapestUsd != null ? [{ label: `${counterpart.name} cheapest price`, valueUsd: counterpart.price.cheapestUsd }] : []),
                  ],
                }
              : undefined,
        })}
      />
      {/* Product + AggregateOffer: in ValueListItemBody, beside our own stock (the only offer). */}

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

          <ItemPageTitle name={item.name} game={hub.shortName} />
          {/* The answer, right under the H1: what it is, the chroma link, and
              what it's worth — plain server text, the first thing a crawler
              and an answer engine read. */}
          <p className="mt-4 text-body leading-7 text-text-secondary">
            {aboutSentence(copy)}
            {chromaSentence(copy) ? ` ${chromaSentence(copy)}` : ''}
            {priceSentence(copy) ? ` ${priceSentence(copy)}` : ''}
          </p>
          {/* Internal links: back to its event (the event page links here) and,
              for a Chroma, to the Chroma hub (every Chroma vs its normal version). */}
          {(fromEvent || chromaHubHref || inventoryHref) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {fromEvent && (
                <Link
                  href={`/${gameSlug}/events/${fromEvent.slug}`}
                  className="group inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <CalendarStarIcon aria-hidden size={16} weight="duotone" className="text-text-tertiary group-hover:text-text-primary" />
                  From the {fromEvent.name} Event
                  <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              {chromaHubHref && (
                <Link
                  href={chromaHubHref}
                  className="group inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <DiamondIcon aria-hidden size={16} weight="duotone" className="text-text-tertiary group-hover:text-text-primary" />
                  All {hub.shortName} Chromas
                  <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              {inventoryHref && (
                <Link
                  href={inventoryHref}
                  prefetch={false}
                  className="group inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <CalculatorIcon aria-hidden size={16} weight="duotone" className="text-text-tertiary group-hover:text-text-primary" />
                  Add To Inventory Worth
                  <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )}
        </div>

        <Suspense fallback={<ValueListItemSkeleton withForms={!!counterpart && hasPage(counterpart)} />}>
          <ValueListItemBody
            gameSlug={gameSlug}
            item={item}
            items={items}
            counterpart={counterpart}
            isChroma={!!base}
            typeLabel={typeLabel}
            copy={copy}
            faq={faq}
            howToGet={howToGet}
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
