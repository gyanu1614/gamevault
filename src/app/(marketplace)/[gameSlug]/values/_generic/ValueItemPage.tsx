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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--ct-line)] bg-[var(--ct-surface)] px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ct-text-faint)]">
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-semibold text-[var(--ct-text)]">{value}</dd>
    </div>
  )
}

export default async function ValueItemPage({
  gameSlug,
  itemSlug,
}: {
  gameSlug: string
  itemSlug: string
}) {
  const theme = getGameContentTheme(gameSlug)
  const [items, hubNav] = await Promise.all([
    getValueItems(gameSlug),
    getHubNavData(gameSlug),
  ])

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
      className="relative min-h-screen bg-[var(--ct-bg)]"
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

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ct-text-faint)]">
          {kindLabel}
        </p>
        <h1 className="mt-2 text-[32px] font-bold tracking-tight text-[var(--ct-text)] sm:text-[42px]">
          {item.name}
        </h1>

        {hasPrice ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="font-mono text-[30px] font-bold tabular-nums text-[var(--ct-text)]">
              {usd(price!.cheapestUsd!)}
            </span>
            {price!.averageUsd != null && (
              <span className="font-mono text-[14px] tabular-nums text-[var(--ct-text-muted)]">
                typical {usd(price!.averageUsd)}
              </span>
            )}
            {price!.lowUsd != null && price!.highUsd != null && (
              <span className="font-mono text-[12px] tabular-nums text-[var(--ct-text-faint)]">
                real listings {usd(price!.lowUsd)}–{usd(price!.highUsd)}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ct-text-muted)]">
            We do not publish a price for {item.name} — it is not sold directly
            on the marketplaces we track. Everything below is from the game's
            own data.
          </p>
        )}

        <div className="mt-3">
          <ValuesFreshnessBadge
            lastChangedAt={price?.priceChangedAt ?? null}
            listingCount={price?.sampleSize ?? 0}
            sourceCount={price?.sourceCount ?? 0}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <dl className="grid gap-px border border-[var(--ct-line)] bg-[var(--ct-line)] sm:grid-cols-2 lg:grid-cols-4">
          {item.rarity && <Fact label="Rarity" value={item.rarity} />}
          {item.area && <Fact label="Area" value={item.area} />}
          {item.incomePerSec != null && (
            <Fact label="Income" value={formatIncome(item.incomePerSec)} />
          )}
          {item.kind === 'account_bracket' && item.bracketMin != null && (
            <Fact
              label="Income bracket"
              value={
                item.bracketMax != null
                  ? `${formatIncome(item.bracketMin)} – ${formatIncome(item.bracketMax)}`
                  : `${formatIncome(item.bracketMin)}+`
              }
            />
          )}
          {source && <Fact label="Hatches from" value={source.name} />}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <ValuesBuyModule
          itemName={item.name}
          gameName={theme.name}
          buyHref={hubNav.itemsHref ?? `/${gameSlug}`}
          sellHref={hubNav.sellHref ?? `/${gameSlug}/sell`}
          cheapestUsd={price?.cheapestUsd ?? null}
          // Our own marketplace inventory is still empty for this game, so the
          // module shows the honest "sell yours" state rather than a buy link
          // into an empty category.
          hasListings={false}
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
        <Link
          href={`/${gameSlug}/values`}
          className="text-[13px] font-semibold text-[var(--ct-accent-text)] hover:underline"
        >
          ← All {theme.name} values
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
