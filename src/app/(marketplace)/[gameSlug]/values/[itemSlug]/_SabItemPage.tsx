import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { TrendUpIcon } from '@phosphor-icons/react/dist/ssr/TrendUp'
import { ValueCrossLinks } from '@/components/values/ValueCrossLinks'
import { JsonLd, breadcrumbList, productAggregate, faqPage, valuePage } from '@/lib/seo/jsonld'
import { withArticle } from '@/lib/text/article'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { buildBrainrotFaq } from '@/lib/sab/faq'
import { ItemPageTitle } from '@/components/values/ItemPageTitle'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { StatRow } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_SURFACE } from '@/components/values/styles'
import { formatCash } from '@/lib/sab/format'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { priceHistorySummary } from '@/lib/values/history-summary'
import { readValuePageEvidence } from '@/lib/seo/gate/read'
import { answerSentence, withAnswer } from '@/components/values/value-answer-format'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { ValueItemRails } from '@/components/buy-rails/ValueItemRails'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'
import { ItemHowToGet } from '@/components/values/how-to-get/ItemHowToGet'
import { getItemFacts } from '@/lib/values/item-facts-data'
import { itemFactsGame } from '@/lib/values/item-facts-config'
import { factFaqs, factRows, mergeFaqs } from '@/lib/values/item-facts'
import { sabAbout } from '@/lib/sab/about'
import { rarityMeta } from '@/lib/values/rarity'
import ItemHero from './_ItemHero'
import {
  SAB_GAME,
  asNumber,
  formatDate,
  formatIncome,
  formatIngameCost,
  formatMoney,
  getDefaultTradePrice,
  getMutations,
  getPriceHistory,
  getRelatedBrainrots,
  type BrainrotRow,
} from './_sabItemData'

/**
 * The Steal a Brainrot item page (/steal-a-brainrot/values/[itemSlug]). The
 * route resolves the brainrot and 404s before this renders, so every read
 * here is for a real item and is tagged to it (see _sabItemData).
 */
export default async function SabItemPage({ gameSlug, brainrot }: { gameSlug: string; brainrot: BrainrotRow }) {
  const [mutations, relatedBrainrots, defaultTradePrice, priceHistory, hubNav, evidence, facts] =
    await Promise.all([
      getMutations(brainrot.slug, brainrot.id),
      getRelatedBrainrots(brainrot),
      getDefaultTradePrice(brainrot.slug, brainrot.id),
      getPriceHistory(brainrot.slug, brainrot.id),
      getHubNavData(gameSlug),
      // The SEO evidence: its price_moved_at is the ONE date this page shows,
      // puts in dateModified and lists in the sitemap (a real price move only;
      // a re-crawl that finds the same price does not bump it).
      readValuePageEvidence(SAB_GAME, brainrot.slug),
      // The shared facts (released, origin, verified How To Get).
      getItemFacts(SAB_GAME, brainrot.slug),
    ])
  const priceMovedAt = evidence?.priceMovedAt ?? null

  const hasPublicMarketPrice =
    defaultTradePrice != null &&
    asNumber(defaultTradePrice?.market_value_usd) != null

  const displayPrice = formatMoney(
    hasPublicMarketPrice
      ? defaultTradePrice?.market_value_usd
      : brainrot.display_price_usd,
  )
  // Reputable-seller pricing: the buyer-facing "Cheapest" + "Market price".
  // Market price = the reputable average when we have it, else the corrected
  // value. Cheapest = the reputable low, shown only when it undercuts the market
  // price (a single reputable seller makes them equal).
  const reputableAverage = asNumber(defaultTradePrice?.average_usd)
  const reputableCheapest = asNumber(defaultTradePrice?.cheapest_usd)
  const marketPriceUsd =
    reputableAverage ??
    (hasPublicMarketPrice
      ? asNumber(defaultTradePrice?.market_value_usd)
      : asNumber(brainrot.market_value_usd))
  const marketPrice = formatMoney(marketPriceUsd)
  const cheapestPrice =
    reputableCheapest != null &&
    marketPriceUsd != null &&
    reputableCheapest < marketPriceUsd - 0.005
      ? formatMoney(reputableCheapest)
      : null
  const marketValue = formatMoney(
    hasPublicMarketPrice
      ? defaultTradePrice?.market_value_usd
      : brainrot.market_value_usd,
  )
  const marketLow = formatMoney(defaultTradePrice?.market_low_usd)
  const marketHigh = formatMoney(defaultTradePrice?.market_high_usd)
  const marketSampleSize = defaultTradePrice?.external_sample_size ?? 0
  const effectiveConfidenceLabel = hasPublicMarketPrice
    ? defaultTradePrice?.confidence_label
    : brainrot.confidence_label
  const quickSale = formatMoney(brainrot.quick_sale_usd)
  const patientSale = formatMoney(brainrot.patient_sale_usd)
  const updatedLabel = formatDate(priceMovedAt)

  // DropMarket's own live stock for this brainrot (Bundle 2): the hero button
  // and "Available Now" read it; cached per game, refreshed by listing changes.
  const buyData = await getValueItemBuyData('steal-a-brainrot', brainrot.slug)
  const buyCategorySlug = buyData?.categorySlug ?? 'buy-items'

  // Highest-value priced mutation (excluding default) for the FAQ copy.
  const topMutation = mutations
    .filter((m) => m.slug !== 'default' && asNumber(m.marketValueUsd) != null)
    .sort((a, b) => (asNumber(b.marketValueUsd) ?? 0) - (asNumber(a.marketValueUsd) ?? 0))[0]

  const game = itemFactsGame(SAB_GAME)
  const buy = { gameSlug: SAB_GAME, itemSlug: brainrot.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }
  // The FAQ: the Brainrot questions, with the facts' verified answers in their place.
  const faqItems = mergeFaqs(buildBrainrotFaq({
    name: brainrot.name,
    rarity: brainrot.rarity,
    obtainability: brainrot.obtainability,
    baseIncomePerSecond: brainrot.base_income_per_second,
    ingameCost: brainrot.ingame_cost,
    defaultPriceUsd: hasPublicMarketPrice
      ? (defaultTradePrice?.market_value_usd ?? null)
      : brainrot.market_value_usd,
    lowUsd: defaultTradePrice?.market_low_usd ?? null,
    highUsd: defaultTradePrice?.market_high_usd ?? null,
    topMutation: topMutation
      ? { name: topMutation.name, priceUsd: topMutation.marketValueUsd }
      : null,
    sampleSize: marketSampleSize,
  }), factFaqs({ name: brainrot.name, game, facts, cheapestUsd: reputableCheapest ?? marketPriceUsd }))
  const factList = factRows(facts)
  const canonicalPath = `/steal-a-brainrot/values/${brainrot.slug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="tall">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
          { name: brainrot.name, path: canonicalPath },
        ])}
      />

      <JsonLd
        data={valuePage({
          name: `${brainrot.name} Value in Steal a Brainrot`,
          path: canonicalPath,
          description: withAnswer(
            answerSentence({ name: brainrot.name, valueUsd: evidence?.valueUsd, offers: evidence?.observations ?? 0, updatedAt: priceMovedAt }),
            `${brainrot.name} value, income and mutations in Steal a Brainrot.`,
          ),
          dateModified: priceMovedAt,
          // Default first, then the four most valuable priced mutations.
          item: {
            name: brainrot.name,
            values: [
              ...mutations.filter((m) => m.slug === 'default' && asNumber(m.marketValueUsd) != null),
              ...mutations
                .filter((m) => m.slug !== 'default' && asNumber(m.marketValueUsd) != null)
                .sort((a, b) => (asNumber(b.marketValueUsd) ?? 0) - (asNumber(a.marketValueUsd) ?? 0))
                .slice(0, 4),
            ].map((m) => ({ label: `${m.name} value`, valueUsd: asNumber(m.marketValueUsd)! })),
          },
        })}
      />

      {brainrot.active_listing_count > 0 && brainrot.cheapest_active_price_usd != null && (
        <JsonLd
          data={productAggregate({
            name: `${brainrot.name} — Steal a Brainrot`,
            description: `Buy ${brainrot.name} from verified DropMarket sellers.`,
            brand: 'Steal a Brainrot',
            lowPrice: Number(brainrot.cheapest_active_price_usd),
            highPrice: Number(brainrot.patient_sale_usd ?? brainrot.cheapest_active_price_usd),
            offerCount: brainrot.active_listing_count,
            url: canonicalPath,
          })}
        />
      )}

      <HubNav data={hubNav} />

      {/* pt clears the fixed HubNav. */}
      <section className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-secondary">
          <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-text-primary">
            Values
          </Link>
          <CaretRightIcon aria-hidden size={13} weight="bold" className="text-text-disabled" />
          {/* Plain text: ?rarity= is robots-blocked and the hub ignores it, so
              the link spent crawl on a dead URL (Bundle 1 hand-off). */}
          <span>{brainrot.rarity}</span>
          <CaretRightIcon aria-hidden size={13} weight="bold" className="text-text-disabled" />
          <span className="font-medium text-text-primary">{brainrot.name}</span>
        </nav>

        {/* The query phrase as the H1, like Adopt Me and MM2; the hero names the mutation (h2). */}
        <ItemPageTitle name={brainrot.name} game="Steal a Brainrot" />

        <div className="mt-6">
          <ItemHero
            brainrotName={brainrot.name}
            rarity={brainrot.rarity}
            baseIncomePerSecond={asNumber(brainrot.base_income_per_second)}
            ingameCost={formatIngameCost(brainrot.ingame_cost)}
            imageUrl={brainrot.image_url}
            imageAlt={brainrot.image_alt}
            mutations={mutations}
            buy={{ itemSlug: brainrot.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }}
            priceHistory={priceHistory}
            updatedAt={priceMovedAt}
          />
        </div>
      </section>

      <ValueItemRails gameSlug="steal-a-brainrot" itemSlug={brainrot.slug} itemName={brainrot.name} imageUrl={brainrot.image_url ?? null}>
      <AvailableNow
        gameSlug="steal-a-brainrot"
        gameName="Steal a Brainrot"
        categorySlug={buyCategorySlug}
        itemSlug={brainrot.slug}
        itemName={brainrot.name}
        offers={buyData?.offers ?? []}
        total={buyData?.stock?.total ?? 0}
        sellHref="/steal-a-brainrot/sell?src=sab-item-page"
      />

      {/* From 1280px the buy rails take both sides, so the market stats move
          under the main sections (two cards side by side) instead of a third
          column. */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 xl:grid-cols-1">
        <div className="space-y-6">

          <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold text-text-primary">
              How much is {brainrot.name} worth?
            </h2>
            {/* Answer-first, dated, quotable lead sentence — the exact string an
                AI answer engine (ChatGPT/Perplexity) lifts as a citation. Kept
                as plain server-rendered text (AI crawlers run no JavaScript).
                See search-engines-ai-seo-research memo (Princeton GEO study:
                statistics + freshness are the top citation levers). */}
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {marketValue ? (
                <>
                  The current value of <strong className="font-semibold text-text-primary">{brainrot.name}</strong>{' '}
                  in Steal a Brainrot is <strong className="font-semibold text-text-primary">{marketValue}</strong>
                  {updatedLabel ? <> as of {updatedLabel}</> : null}, based on live DropMarket
                  marketplace data. It is {withArticle(brainrot.rarity)} Brainrot with a base income of{' '}
                  {formatIncome(brainrot.base_income_per_second)}.
                </>
              ) : (
                <>
                  {brainrot.name} is {withArticle(brainrot.rarity)} Brainrot in Steal a Brainrot with a base income
                  of {formatIncome(brainrot.base_income_per_second)}. Live pricing is still being
                  collected — check back as DropMarket gathers more marketplace data.
                </>
              )}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-tertiary">
              Estimated from recent comparable marketplace listings by reputable sellers when available. Extreme prices, bundles, and unclear variants are excluded.
            </p>

            <dl className="mt-5">
              <StatRow label="Cheapest Active Listing" value={cheapestPrice ?? 'No active listings'} />
              <StatRow label="Current Market Price" value={marketValue ?? 'Insufficient data'} />
              <StatRow label="Quick-Sale Estimate" value={quickSale ?? 'Insufficient data'} />
              <StatRow label="Patient-Sale Estimate" value={patientSale ?? 'Insufficient data'} />
            </dl>
          </section>

          <ItemHowToGet
            itemName={brainrot.name}
            game={game}
            imageUrl={brainrot.image_url}
            accent={rarityMeta(SAB_GAME, brainrot.rarity).color}
            howToGet={facts.howToGet}
            cheapestUsd={reputableCheapest ?? marketPriceUsd}
            buy={buy}
          />

          <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold text-text-primary">About {brainrot.name}</h2>
            {/* Written from this brainrot's own facts (src/lib/sab/about.ts), not one template for all. */}
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {sabAbout({
                name: brainrot.name,
                rarity: brainrot.rarity,
                income: asNumber(brainrot.base_income_per_second) != null ? `$${formatIncome(brainrot.base_income_per_second)}` : null,
                cost: formatIngameCost(brainrot.ingame_cost),
                obtainability: brainrot.obtainability,
                facts,
              })}
            </p>
            {factList.length > 0 && (
              <dl className="mt-4">
                {factList.map((f) => (
                  <StatRow key={f.label} label={f.label} value={f.value} />
                ))}
              </dl>
            )}
            {brainrot.source_url && (
              <a
                href={brainrot.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                View Source Information
                <ArrowSquareOutIcon aria-hidden size={16} weight="bold" />
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-6 xl:grid xl:grid-cols-2 xl:gap-6 xl:space-y-0">
          <section className={`${VALUE_SURFACE} p-5`}>
            <div className="flex items-center gap-2">
              <TrendUpIcon aria-hidden size={18} weight="bold" className="text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Market activity</h2>
            </div>
            <dl className="mt-4">
              <StatRow label="Active Listings" value={(brainrot.active_listing_count ?? 0).toLocaleString()} />
              <StatRow label="Completed Sales" value={(brainrot.completed_sale_count ?? 0).toLocaleString()} />
              <StatRow label="Unique Sellers" value={(brainrot.unique_seller_count ?? 0).toLocaleString()} />
              <StatRow label="Confidence" value={<span className="capitalize">{effectiveConfidenceLabel}</span>} />
            </dl>
            {/* What the browser-only chart shows, as text crawlers can read. */}
            {(() => {
              const line = priceHistorySummary(brainrot.name, (priceHistory.default ?? []).map((p) => ({ date: p.date, price: p.median })))
              return line ? <p className="mt-4 text-meta leading-6 text-text-tertiary">{line}</p> : null
            })()}
          </section>

          <section className={`${VALUE_SURFACE} p-5`}>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon aria-hidden size={18} weight="bold" className="text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Pricing integrity</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-text-secondary">
              Extreme prices, bundles, account sales, unclear mutations, test listings, cancelled orders, refunds, disputes, and unverified mappings are excluded from market calculations.
            </p>
          </section>
        </aside>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SimilarItemsRail
          title={`Similar ${brainrot.rarity} Brainrots`}
          seeAllHref="/steal-a-brainrot/values"
          itemNoun="brainrots"
          className="border-t border-white/[0.07] pt-10"
          items={relatedBrainrots.map((r) => ({
            key: r.id,
            href: `/steal-a-brainrot/values/${r.slug}`,
            name: r.name,
            imageSrc: r.image_url,
            imageAlt: `${r.name} Steal a Brainrot`,
            price: formatCash(r.display_price_usd) ?? 'Price pending',
          }))}
        />

        {/* Curated FAQ — unique per brainrot (SEO) + FAQPage structured data. */}
        {/* Search-shaped heading (owner, 2026-10-14: "Griffin — questions" read as a placeholder). */}
        <HubFaqSection
          title={`${brainrot.name} FAQ`}
          subtitle={`What ${brainrot.name} is worth, how to get it and how to trade it in Steal a Brainrot.`}
          items={faqItems}
        />
      </div>
      <JsonLd data={faqPage(faqItems)} />

      {/* Cross-links — back to the list + how values are calculated (E-E-A-T:
          every cited value links to its methodology, parity with Adopt Me). */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-10 sm:px-6 lg:px-8">
        <ValueCrossLinks
          ariaLabel="More Steal a Brainrot values"
          back={{ href: '/steal-a-brainrot/values', label: 'All Steal a Brainrot Values', short: 'All Values' }}
          method={{ href: '/steal-a-brainrot/values/methodology', label: 'How We Value Items', short: 'Our Method' }}
        />
      </div>
      </ValueItemRails>
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
