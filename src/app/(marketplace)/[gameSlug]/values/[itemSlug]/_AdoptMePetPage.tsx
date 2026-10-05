import Link from '@/components/navigation/AppLink'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { AdoptMePriceTrend } from './_AdoptMePriceTrend'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import {
  getSimilarPets,
  type AdoptMePetDetail,
  type AdoptMePetVariant,
} from './_adoptMePetData'
import AdoptMePetHero from './_AdoptMePetHero'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { rarityMeta as sharedRarityMeta } from '@/lib/values/rarity'
import { AdoptMeAboutStats } from './_AdoptMeAboutStats'
import { SelectedVariantProvider } from './_SelectedVariantContext'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'

const OBTAINABILITY_LABEL: Record<string, string> = {
  obtainable: 'Obtainable',
  limited: 'Limited',
  unobtainable: 'Unobtainable',
}

// Trade-points formatter — used by the per-pet FAQ copy below.
const TRADE = new Intl.NumberFormat('en-US')
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const rarityMeta = (r: string) => sharedRarityMeta('adopt-me', r)

/**
 * Lightly highlight the freeform description so the eye catches the facts that
 * matter: years (2019), quantities (180 Halloween Candy), and the availability
 * keywords traders care about (unobtainable, limited, event, Robux). Keeps the
 * copy as-is — only wraps matched tokens in an emphasis span. Order matters:
 * longer keyword phrases before bare numbers so they aren't split.
 */
// The highlight pattern as a SOURCE string. A fresh RegExp is built per call
// (never a shared module-level `g`-flag instance) — a shared one carries a
// mutable `lastIndex` that leaks between the server render and hydration,
// producing different match sets and a hydration mismatch.
const HIGHLIGHT_SRC = [
  '\\b(?:un)?obtainable\\b',
  '\\blimited\\b',
  '\\bRobux\\b',
  "\\b\\d{4}\\s+(?:Halloween|Christmas|Easter|Valentine(?:'s)?|Summer|Winter|Lunar)\\s+Event\\b",
  '\\b\\d[\\d,]*\\s+(?:Halloween Candy|Candy|Gingerbread|Bucks|trade points)\\b',
  '\\b(?:19|20)\\d{2}\\b',
].join('|')

function HighlightedDescription({ text }: { text: string }) {
  const re = new RegExp(HIGHLIGHT_SRC, 'gi')
  const nodes: (string | React.ReactElement)[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    // Zero-width match guard — never possible here, but keeps the loop safe.
    if (m.index === re.lastIndex) re.lastIndex += 1
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(
      <span key={`${m.index}-${m[0]}`} className="font-semibold text-text-primary">
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes}</>
}

/** FR is what "value" means in trade chat — lead the hero with it. */
function benchmark(pet: AdoptMePetDetail): AdoptMePetVariant | undefined {
  return pet.variants.find((v) => v.variant === 'FR') ?? pet.variants[0]
}

function petFaq(pet: AdoptMePetDetail) {
  const fr = benchmark(pet)
  const frTrade = fr?.tradeValue != null ? TRADE.format(fr.tradeValue) : 'its listed'
  return [
    {
      q: `How much is a ${pet.name} worth in Adopt Me?`,
      a: `A Fly Ride ${pet.name} is worth around ${frTrade} in community trade value. Its cash value in real money is shown on this page and is built from DropMarket marketplace activity; where we don't yet hold enough sales, the cash value is a clearly-marked estimate derived from the variant ladder.`,
    },
    {
      q: `Is the ${pet.name} still obtainable?`,
      a:
        pet.obtainability === 'unobtainable'
          ? `No. The ${pet.name} is unobtainable — it came from a past event or a retired egg and can no longer be obtained through normal play. The only way to get one now is a trade or a cash purchase.`
          : `The ${pet.name} is currently ${OBTAINABILITY_LABEL[pet.obtainability]?.toLowerCase() ?? pet.obtainability}. Availability can change with Adopt Me updates.`,
    },
    {
      q: `What is a Fly Ride (FR) ${pet.name}?`,
      a: `A Fly Ride ${pet.name} has had both a Fly Potion and a Ride Potion applied, letting you fly and ride it. FR is the standard trading benchmark — when traders quote a pet's value, they usually mean its Fly Ride value.`,
    },
    {
      q: `Why do the cash value and trade value differ?`,
      a: `Trade value is the community's consensus in points, used for checking whether a trade is fair. Cash value is what the pet actually sells for in real money on DropMarket. They diverge because community ratings lag real demand — which is exactly why we show both.`,
    },
  ]
}

export default async function AdoptMePetPage({ pet }: { pet: AdoptMePetDetail }) {
  const fr = benchmark(pet)
  // This pet's FR cash value — used to rank similar pets by value proximity.
  const refFrUsd = fr?.cheapestUsd ?? fr?.cashUsd ?? null

  const [hubNav, similar, buyData] = await Promise.all([
    getHubNavData('adopt-me'),
    getSimilarPets(pet.rarity, pet.slug, refFrUsd),
    // DropMarket's own live stock (Bundle 2): buy buttons + "Available Now".
    getValueItemBuyData('adopt-me', pet.slug),
  ])
  const buyCategorySlug = buyData?.categorySlug ?? 'buy-items'

  const meta = rarityMeta(pet.rarity)
  const faq = petFaq(pet)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Adopt Me', path: '/adopt-me' },
          { name: 'Values', path: '/adopt-me/values' },
          { name: pet.name, path: `/adopt-me/values/${pet.slug}` },
        ])}
      />
      <JsonLd data={faqPage(faq)} />
      {/* Product + Offer: the cash value is the Offer. Only emitted when we hold
          a real (non-null) cash number; an estimated/null price is not an offer. */}
      {fr?.cashUsd != null && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: `${pet.name} (Fly Ride) — Adopt Me`,
            image: pet.imageUrl ? [pet.imageUrl] : undefined,
            description: pet.description.slice(0, 300),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'USD',
              price: fr.cashUsd,
              availability: 'https://schema.org/InStock',
            },
          }}
        />
      )}

      {/* Everything the variant selection touches — hero, callout, stats, chart —
          lives inside one provider so picking a form up top reprices it all. */}
      <SelectedVariantProvider initial="FR">
      <GameHeroBackdrop gameSlug="adopt-me" size="tall">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-caption text-text-tertiary">
            <Link href="/adopt-me/values" className="transition-colors hover:text-text-primary">Values</Link>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            <span className="text-text-primary">{pet.name}</span>
          </nav>

          <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em] text-text-primary sm:text-display">
            {pet.name} Value in Adopt Me
          </h1>
          <p className="mt-3 max-w-2xl text-body leading-7 text-text-secondary">
            What a {pet.name} is worth in trade — and in real money.
          </p>

          {/* Interactive hero + variant grid — SAB's ItemHero layout, Adopt Me
              data (dual-axis, potion/Neon variants instead of mutations). */}
          <div className="mt-6">
            <AdoptMePetHero
              name={pet.name}
              rarityLabel={meta.label}
              rarityColor={meta.color}
              obtainabilityLabel={OBTAINABILITY_LABEL[pet.obtainability] ?? pet.obtainability}
              imageUrl={pet.imageUrl}
              buy={{ itemSlug: pet.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }}
              variants={pet.variants}
            />
          </div>
        </div>
      </GameHeroBackdrop>

      <AvailableNow
        gameSlug="adopt-me"
        gameName="Adopt Me"
        categorySlug={buyCategorySlug}
        itemSlug={pet.slug}
        itemName={pet.name}
        offers={buyData?.offers ?? []}
        total={buyData?.stock?.total ?? 0}
        sellHref="/adopt-me/sell?src=am-item-page"
      />

      <div className="relative mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Answer-first, dated lead + market-activity strip ─────────────────
            A single quotable sentence stating the current FR value AS OF a date
            (what a featured-snippet / AI answer lifts), then the About copy and
            a compact stats row. Only renders the price sentence when FR is
            actually priced. ──────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-5 text-heading font-bold tracking-tight text-text-primary">About The {pet.name}</h2>

          {/* Quick-answer callout + market-activity stats — both reprice to the
              variant selected in the hero (via SelectedVariantContext). */}
          <AdoptMeAboutStats
            name={pet.name}
            variants={pet.variants}
            buy={{ itemSlug: pet.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }}
          />

          <p className="mt-6 text-body leading-7 text-text-secondary">
            <HighlightedDescription text={pet.description} />
          </p>
        </section>

        {/* ── Price trend — daily history for the SELECTED variant (shared with
            the hero). One focused line + range tabs; its own dropdown writes the
            selection back so the hero + stats follow too. ─────────────────── */}
        <AdoptMePriceTrend history={pet.priceHistory} />

        {/* ── Similar pets — the shared values rail ───────────────────────── */}
        <SimilarItemsRail
          title={`Similar ${meta.label} Pets`}
          seeAllHref="/adopt-me/values"
          itemNoun="pets"
          className="border-t border-white/[0.07] pt-10"
          items={similar.map((item) => ({
            key: item.slug,
            href: `/adopt-me/values/${item.slug}`,
            name: item.name,
            imageSrc: item.imageUrl,
            imageAlt: `${item.name} — Adopt Me`,
            price: item.frCashUsd != null ? `${USD.format(item.frCashUsd)} FR` : 'Price pending',
          }))}
        />

        {/* ── FAQ — the shared content-hub FAQ block. ─────────────────────── */}
        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`Everything about the ${pet.name}'s value, variants and how to buy it.`}
          items={faq}
        />

        {/* Cross-links — back to the whole list on the left, the methodology
            page on the right (E-E-A-T: every cited value links to how we
            calculate it). Each side is a labelled two-line link. */}
        <nav aria-label="More Adopt Me values" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/adopt-me/values"
            className={`${VALUE_SURFACE_LINK} group flex items-center gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <CaretLeftIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:-translate-x-0.5 group-hover:text-text-primary" />
            <span>
              <span className={`block ${VALUE_LABEL}`}>Back to</span>
              <span className="block text-body-sm font-semibold text-text-primary">All Adopt Me Values</span>
            </span>
          </Link>
          <Link
            href="/adopt-me/values/methodology"
            className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <span>
              <span className={`block ${VALUE_LABEL}`}>Our Method</span>
              <span className="block text-body-sm font-semibold text-text-primary">How We Value Pets</span>
            </span>
            <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
          </Link>
        </nav>

        {/* Shared end-of-page CTA with the per-game background hero. */}
        <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref={itemBuyHref({ gameSlug: 'adopt-me', categorySlug: buyCategorySlug, itemSlug: pet.slug })} />
      </div>
      </SelectedVariantProvider>

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
