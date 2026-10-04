import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd, breadcrumbList, productAggregate } from '@/lib/seo/jsonld'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme, contentThemeVars } from '@/lib/content/theme'
import { ValuesFreshnessBadge } from '@/components/content/ValuesFreshnessBadge'
import { ValuesBuyModule } from '@/components/content/ValuesBuyModule'
import { getValueItems, type ValueItem } from '@/lib/values/data'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { ValueItemHero } from '@/components/values/ValueItemHero'
import { HUB_GROUND, VALUE_BTN_SECONDARY } from '@/components/values/styles'

/**
 * Generic value page for any item on the values_* pipeline, priced or not.
 *
 * An UNPRICED item (every Steal An Egg pet) is a first-class case, not an
 * error state: it renders its catalogue facts and points at the priced item it
 * comes from. It never shows a number we cannot back with listings.
 */

const usd = (v: number) =>
  v < 1 ? `$${v.toFixed(2)}` : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

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
  const [items, hubNav, buyData] = await Promise.all([
    getValueItems(gameSlug),
    getHubNavData(gameSlug),
    // DropMarket's own live stock (Bundle 2): buy button + "Available Now".
    getValueItemBuyData(gameSlug, itemSlug),
  ])
  const buyCategorySlug = buyData?.categorySlug ?? 'buy-items'

  const item = items.find((i) => i.slug === itemSlug)
  if (!item) notFound()

  const source = item.sourceItemId
    ? items.find((i) => i.id === item.sourceItemId) ?? null
    : null

  const price = item.price
  const hasPrice = price?.cheapestUsd != null
  // The brief's rule: a value with fewer than 3 live listings behind it is not
  // strong enough to index.
  const thin = !hasPrice || (price?.sampleSize ?? 0) < 3

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
      {/* Product schema only where a real price backs it. */}
      {hasPrice && !thin && (
        <JsonLd
          data={productAggregate({
            name: `${item.name} — ${theme.name}`,
            description: `What ${item.name} sells for in ${theme.name}, priced from ${price!.sampleSize} live marketplace listings.`,
            brand: theme.name,
            lowPrice: price!.cheapestUsd!,
            highPrice: price!.highUsd ?? price!.cheapestUsd!,
            offerCount: price!.sampleSize,
            url: `/${gameSlug}/values/${item.slug}`,
          })}
        />
      )}

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <ValueItemHero
          art={item.imageUrl ? { src: item.imageUrl, alt: item.name } : null}
          eyebrow={kindLabel}
          title={item.name}
          stats={facts}
          price={
            hasPrice
              ? {
                  value: usd(price!.cheapestUsd!),
                  children: (
                    <>
                      {price!.averageUsd != null && (
                        <p className="mt-2 text-[14px] tabular-nums text-text-secondary">
                          typical {usd(price!.averageUsd)}
                        </p>
                      )}
                      {price!.lowUsd != null && price!.highUsd != null && (
                        <p className="mt-1 text-[12px] tabular-nums text-text-tertiary">
                          real listings {usd(price!.lowUsd)}–{usd(price!.highUsd)}
                        </p>
                      )}
                    </>
                  ),
                }
              : {
                  children: (
                    <p className="text-left text-[15px] leading-relaxed text-text-secondary">
                      We do not publish a price for {item.name} — it is not sold directly
                      on the marketplaces we track. Everything below is from the game&apos;s
                      own data.
                    </p>
                  ),
                }
          }
          footer={
            // The badge renders nothing without a dated, listing-backed price.
            price?.priceChangedAt && (price.sampleSize ?? 0) > 0 ? (
              <ValuesFreshnessBadge
                lastChangedAt={price.priceChangedAt}
                listingCount={price.sampleSize}
                sourceCount={price.sourceCount ?? 0}
              />
            ) : null
          }
        />
      </section>

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

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Link href={`/${gameSlug}/values`} className={VALUE_BTN_SECONDARY}>
          <ArrowLeftIcon aria-hidden size={15} weight="bold" />
          All {theme.name} Values
        </Link>
      </div>

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
