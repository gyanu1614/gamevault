import Link from 'next/link'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { FaqCards } from '@/components/marketplace/FaqCards'
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

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

function rarityMeta(r: string) {
  return RARITY_META[r] ?? { label: r, color: '#9BA8A0' }
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
  const [hubNav, similar] = await Promise.all([
    getHubNavData('adopt-me'),
    getSimilarPets(pet.rarity, pet.slug, 6),
  ])

  const meta = rarityMeta(pet.rarity)
  const fr = benchmark(pet)
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

      <SabHeroBackdrop>
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-[#6D7A72]">
            <Link href="/adopt-me/values" className="transition-colors hover:text-[#F1F3F1]">Values</Link>
            <span>›</span>
            <span className="text-[#E6EAE7]">{pet.name}</span>
          </nav>

          <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-[#F2F6F0] sm:text-[40px]">
            {pet.name} Value in Adopt Me
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#98A398]">
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
        {/* ── Per-pet context (the anti-thin-content asset) ────────────────── */}
        <section>
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight text-[#F1F3F1]">About the {pet.name}</h2>
          {/* Full container width (was capped at max-w-3xl / half screen). */}
          <p className="text-[15px] leading-7 text-[#C6CEC9]">{pet.description}</p>
        </section>

        {/* ── Similar pets — SAB carousel layout, neutral chrome ───────────── */}
        <AdoptMeSimilar rarityLabel={meta.label} items={similar} />

        {/* ── FAQ — the shared content-hub FaqCards (square = neutral hub).
            Heading sits in the SAME max-w-3xl column as the cards so the two
            line up (FaqCards centers its cards in mx-auto max-w-3xl). ─────── */}
        <section className="border-t border-white/[0.07] pt-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[26px] font-bold tracking-tight text-[#F1F3F1] sm:text-[32px]">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-[15px] text-[#9BA8A0]">
              Everything about the {pet.name}&apos;s value, variants and how to buy it.
            </p>
          </div>
          <FaqCards items={faq} square defaultOpen={0} className="mt-6" />
        </section>

        {/* Cross-links — back to the list + the methodology page (E-E-A-T:
            every cited value links to how we calculate it). The buy action
            lives in the CTA modal below, so no duplicate buy button here. */}
        <div className="flex flex-wrap gap-3">
          <Link href="/adopt-me/values" className="inline-flex items-center gap-2 border border-[#26332C] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#C6CEC9] transition hover:border-[#2A3A31] hover:bg-white/[0.06]">
            ← All Adopt Me values
          </Link>
          <Link href="/adopt-me/values/methodology" className="inline-flex items-center gap-2 border border-[#26332C] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#C6CEC9] transition hover:border-[#2A3A31] hover:bg-white/[0.06]">
            How we value pets
          </Link>
        </div>

        {/* Shared end-of-page CTA with the per-game background hero. */}
        <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref={`/adopt-me/buy-items?pet=${pet.slug}`} />
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
