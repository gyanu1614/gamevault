import Link from 'next/link'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { AdoptMePriceTrend } from './_AdoptMePriceTrend'
import { SabHeroBackdrop } from '../_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import {
  getSimilarPets,
  type AdoptMePetDetail,
  type AdoptMePetVariant,
} from './_adoptMePetData'
import AdoptMePetHero from './_AdoptMePetHero'
import { AdoptMeSimilar } from './_AdoptMeSimilar'
import { AdoptMeAboutStats } from './_AdoptMeAboutStats'
import { SelectedVariantProvider } from './_SelectedVariantContext'
import { HubBuyCta } from '@/components/content/HubBuyCta'

const RARITY_META: Record<string, { label: string; color: string }> = {
  legendary: { label: 'Legendary', color: '#F5C542' },
  ultra_rare: { label: 'Ultra-Rare', color: '#B07BC9' },
  rare: { label: 'Rare', color: '#4FB477' },
  uncommon: { label: 'Uncommon', color: '#7FE3F0' },
  common: { label: 'Common', color: '#9BA8A0' },
}
const OBTAINABILITY_LABEL: Record<string, string> = {
  obtainable: 'Obtainable',
  limited: 'Limited',
  unobtainable: 'Unobtainable',
}

// Trade-points formatter — used by the per-pet FAQ copy below.
const TRADE = new Intl.NumberFormat('en-US')

function rarityMeta(r: string) {
  return RARITY_META[r] ?? { label: r, color: '#9BA8A0' }
}

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
      <span key={`${m.index}-${m[0]}`} className="font-semibold text-[#CBD6CD]">
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

  const [hubNav, similar] = await Promise.all([
    getHubNavData('adopt-me'),
    getSimilarPets(pet.rarity, pet.slug, refFrUsd),
  ])

  const meta = rarityMeta(pet.rarity)
  const faq = petFaq(pet)

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
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
      <SabHeroBackdrop>
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-1.5 text-caption text-[#6D7A72]">
            <Link href="/adopt-me/values" className="transition-colors hover:text-[#F1F3F1]">Values</Link>
            <span>›</span>
            <span className="text-[#E6EAE7]">{pet.name}</span>
          </nav>

          <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em] text-[#F2F6F0] sm:text-display">
            {pet.name} Value in Adopt Me
          </h1>
          <p className="mt-3 max-w-2xl text-body leading-7 text-[#98A398]">
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
              buyHref={`/adopt-me/buy-items?pet=${pet.slug}`}
              variants={pet.variants}
            />
          </div>
        </div>
      </SabHeroBackdrop>

      <div className="relative mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Answer-first, dated lead + market-activity strip ─────────────────
            A single quotable sentence stating the current FR value AS OF a date
            (what a featured-snippet / AI answer lifts), then the About copy and
            a compact stats row. Only renders the price sentence when FR is
            actually priced. ──────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-5 text-heading font-bold tracking-tight text-[#F1F3F1]">About The {pet.name}</h2>

          {/* Quick-answer callout + market-activity stats — both reprice to the
              variant selected in the hero (via SelectedVariantContext). */}
          <AdoptMeAboutStats name={pet.name} slug={pet.slug} variants={pet.variants} />

          <p className="mt-6 text-body leading-7 text-[#A9B4AD]">
            <HighlightedDescription text={pet.description} />
          </p>
        </section>

        {/* ── Price trend — daily history for the SELECTED variant (shared with
            the hero). One focused line + range tabs; its own dropdown writes the
            selection back so the hero + stats follow too. ─────────────────── */}
        <AdoptMePriceTrend history={pet.priceHistory} />

        {/* ── Similar pets — SAB carousel layout, neutral chrome ───────────── */}
        <AdoptMeSimilar rarityLabel={meta.label} rarityColor={meta.color} items={similar} />

        {/* ── FAQ — the shared content-hub FaqCards (square = neutral hub).
            Heading sits in the SAME max-w-3xl column as the cards so the two
            line up (FaqCards centers its cards in mx-auto max-w-3xl). ─────── */}
        <section className="border-t border-white/[0.07] pt-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[26px] font-bold tracking-tight text-[#F1F3F1] sm:text-heading">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-body text-[#9BA8A0]">
              Everything about the {pet.name}&apos;s value, variants and how to buy it.
            </p>
          </div>
          <FaqCards items={faq} square defaultOpen={0} className="mt-6" />
        </section>

        {/* Cross-links — a single full-width nav strip (not two orphan pills):
            back to the whole list on the left, the methodology page on the right
            (E-E-A-T: every cited value links to how we calculate it). Each side
            is a labelled two-line link with an icon that slides on hover. */}
        <nav className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#1E2723] sm:grid-cols-2">
          <Link
            href="/adopt-me/values"
            className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
          >
            <ChevronLeftIcon sx={{ fontSize: 22 }} className="shrink-0 text-[#6D7A72] transition-transform group-hover:-translate-x-0.5 group-hover:text-[#8FBF9C]" />
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.1em] text-[#6D7A72]">Back to</span>
              <span className="block text-body-sm font-semibold text-[#E6EAE7] group-hover:text-white">All Adopt Me Values</span>
            </span>
          </Link>
          <Link
            href="/adopt-me/values/methodology"
            className="group flex items-center justify-between gap-3 border-t border-[#1E2723] px-5 py-4 transition-colors hover:bg-white/[0.03] sm:border-l sm:border-t-0"
          >
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.1em] text-[#6D7A72]">Our Method</span>
              <span className="block text-body-sm font-semibold text-[#E6EAE7] group-hover:text-white">How We Value Pets</span>
            </span>
            <ChevronRightIcon sx={{ fontSize: 22 }} className="shrink-0 text-[#6D7A72] transition-transform group-hover:translate-x-0.5 group-hover:text-[#8FBF9C]" />
          </Link>
        </nav>

        {/* Shared end-of-page CTA with the per-game background hero. */}
        <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref={`/adopt-me/buy-items?pet=${pet.slug}`} />
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
