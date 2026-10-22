import { readValuePageEvidence } from '@/lib/seo/gate/read'
import { answerSentence, withAnswer } from '@/components/values/value-answer-format'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { JsonLd, breadcrumbList, faqPage, ownStockProduct, valuePage } from '@/lib/seo/jsonld'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { valueItemFaq } from './valueItemFaq'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme, contentThemeVars } from '@/lib/content/theme'
import { ValuesBuyModule } from '@/components/content/ValuesBuyModule'
import { getValueItems, type ValueItem } from '@/lib/values/data'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { ValueItemRails } from '@/components/buy-rails/ValueItemRails'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { ValueListItemHero } from './ValueListItemClient'
import { parseImageAttribution } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { isNewItem } from '@/lib/values/new-item'
import { HUB_GROUND, VALUE_BTN_SECONDARY } from '@/components/values/styles'

/**
 * Generic value page for any item on the values_* pipeline, priced or not.
 *
 * An UNPRICED item (every Steal An Egg pet) is a first-class case, not an
 * error state: it renders its catalogue facts and points at the priced item it
 * comes from. It never shows a number we cannot back with listings.
 */

function formatIncome(perSec: number): string {
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (perSec >= size) {
      const n = perSec / size
      return `${n >= 10 ? Math.round(n) : n.toFixed(1)}${suffix}/s`
    }
  }
  return `${perSec}/s`
}

export default async function ValueItemPage({
  gameSlug,
  itemSlug,
}: {
  gameSlug: string
  itemSlug: string
}) {
  const theme = getGameContentTheme(gameSlug)
  const [items, hubNav, buyData, evidence] = await Promise.all([
    // Read under THIS item's tags (never the game list tag — T1).
    getValueItems(gameSlug, { itemSlug }),
    getHubNavData(gameSlug),
    // DropMarket's own live stock (Bundle 2): buy button + "Available Now".
    getValueItemBuyData(gameSlug, itemSlug),
    // The ONE page date: the last material price move (seo_value_evidence).
    readValuePageEvidence(gameSlug, itemSlug),
  ])
  const priceMovedAt = evidence?.priceMovedAt ?? null
  const buyCategorySlug = buyData?.categorySlug ?? 'buy-items'

  const item = items.find((i) => i.slug === itemSlug)
  if (!item) notFound()

  const source = item.sourceItemId
    ? items.find((i) => i.id === item.sourceItemId) ?? null
    : null

  const price = item.price
  const hasPrice = price?.cheapestUsd != null

  // Catalogue facts → the hero's stat rows.
  const facts: { label: string; value: string }[] = []
  if (item.rarity) facts.push({ label: 'Rarity', value: item.rarity })
  if (item.area) facts.push({ label: 'Area', value: item.area })
  if (item.incomePerSec != null) facts.push({ label: 'Income', value: formatIncome(item.incomePerSec) })
  if (item.kind === 'account_bracket' && item.bracketMin != null) {
    facts.push({
      label: 'Income Bracket',
      value:
        item.bracketMax != null
          ? `${formatIncome(item.bracketMin)} – ${formatIncome(item.bracketMax)}`
          : `${formatIncome(item.bracketMin)}+`,
    })
  }
  if (source) facts.push({ label: 'Hatches From', value: source.name })

  const kindLabel =
    item.kind === 'account_bracket'
      ? 'Account'
      : item.kind === 'area'
        ? 'Area'
        : item.kind === 'pet'
          ? 'Pet'
          : 'Egg'
  // The item's type leads its fact rows (owner, 2026-10-12: Type, Rarity, …).
  facts.unshift({ label: 'Type', value: kindLabel })

  // Only what the catalogue and listings say (valueItemFaq.ts); the schema uses the same list.
  const productLd = ownStockProduct({
    name: `${item.name} — ${theme.name}`,
    description: `What ${item.name} sells for in ${theme.name} on DropMarket.`,
    brand: theme.name,
    url: `/${gameSlug}/values/${item.slug}`,
    image: item.imageUrl,
    stock: buyData?.stock ?? null,
    offerPrices: (buyData?.offers ?? []).map((o) => o.pricePerUnit),
  })

  const faq = valueItemFaq({ item, gameName: theme.name, items, income: item.incomePerSec != null ? formatIncome(item.incomePerSec) : null })

  return (
    <main
      className={`relative min-h-screen ${HUB_GROUND}`}
      style={contentThemeVars(theme)}
    >
      <HubNav data={hubNav} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Values', path: `/${gameSlug}/values` },
          { name: item.name, path: `/${gameSlug}/values/${item.slug}` },
        ])}
      />
      <JsonLd
        data={valuePage({
          name: `${item.name} Value in ${theme.name}`,
          path: `/${gameSlug}/values/${item.slug}`,
          description: withAnswer(
            hasPrice ? answerSentence({ name: item.name, valueUsd: price!.cheapestUsd, offers: price!.sampleSize ?? 0, updatedAt: priceMovedAt }) : null,
            `${item.name} in ${theme.name}: price, rarity and where it comes from.`,
          ),
          item: hasPrice
            ? {
                name: item.name,
                values: [
                  { label: 'Cheapest price', valueUsd: price!.cheapestUsd!, offers: price!.sampleSize ?? undefined },
                  ...(price!.averageUsd != null ? [{ label: 'Typical price', valueUsd: price!.averageUsd }] : []),
                  ...(price!.highUsd != null ? [{ label: 'Highest price', valueUsd: price!.highUsd }] : []),
                ],
              }
            : undefined,
          dateModified: priceMovedAt,
        })}
      />
      {faq.length > 0 && <JsonLd data={faqPage(faq)} />}
      {/* Product + AggregateOffer only for our own live stock: a market price is not an offer. */}
      {productLd && <JsonLd data={productLd} />}

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        {/* The MM2 client hero: On DropMarket first, then the market price, then
            Value (noPriceFallback); Buy + a quiet Sell line; the New tag. */}
        <ValueListItemHero
          name={item.name}
          accent={item.rarity ? rarityMeta(gameSlug, item.rarity).color : 'var(--color-text-secondary)'}
          imageUrl={item.imageUrl}
          imageAlt={`${item.name} — ${theme.name}`}
          imageCredit={parseImageAttribution(item.imageAttribution)}
          stats={facts}
          cheapestUsd={price?.cheapestUsd ?? null}
          marketUsd={price?.averageUsd ?? null}
          priceChangedAt={priceMovedAt}
          buy={{ gameSlug, itemSlug: item.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }}
          sell={{ href: hubNav.sellHref ?? `/${gameSlug}/sell`, label: 'Sell Yours For Cash' }}
          forms={null}
          isNew={isNewItem({ addedAt: item.addedAt })}
        />
      </section>

      <ValueItemRails gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} imageUrl={item.imageUrl ?? null}>
      <AvailableNow
        gameSlug={gameSlug}
        gameName={theme.name}
        categorySlug={buyCategorySlug}
        itemSlug={item.slug}
        itemName={item.name}
        offers={buyData?.offers ?? []}
        total={buyData?.stock?.total ?? 0}
        sellHref={hubNav.sellHref ?? `/${gameSlug}/sell`}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-14 pt-7 sm:px-6 lg:px-8">
        <ValuesBuyModule
          itemName={item.name}
          gameName={theme.name}
          sellHref={hubNav.sellHref ?? `/${gameSlug}/sell`}
          cheapestUsd={price?.cheapestUsd ?? null}
          buy={{ gameSlug, categorySlug: buyCategorySlug, itemSlug: item.slug, stock: buyData?.stock ?? null }}
          sourceItem={
            source
              ? {
                  name: source.name,
                  slug: source.slug,
                  cheapestUsd: source.price?.cheapestUsd ?? null,
                }
              : null
          }
        />
      </section>

      {faq.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <HubFaqSection title={`${item.name} FAQ`} items={faq} />
        </div>
      )}

      <div className={`mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 ${faq.length > 0 ? 'pt-10' : ''}`}>
        <Link href={`/${gameSlug}/values`} className={VALUE_BTN_SECONDARY}>
          <ArrowLeftIcon aria-hidden size={15} weight="bold" />
          All {theme.name} Values
        </Link>
      </div>
      </ValueItemRails>

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

/** Shared by the route's generateMetadata: thin values must not be indexed. */
export function isThinValue(item: ValueItem): boolean {
  return item.price?.cheapestUsd == null || (item.price?.sampleSize ?? 0) < 3
}
