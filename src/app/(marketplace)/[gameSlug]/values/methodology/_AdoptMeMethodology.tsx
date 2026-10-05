import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { HubSection } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_BTN_SECONDARY, VALUE_LABEL } from '@/components/values/styles'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { FaqCards } from '@/components/marketplace/FaqCards'

/**
 * /adopt-me/values/methodology — the Adopt Me pricing-methodology page.
 *
 * This is deliberately the most thorough, honest page on the hub: it explains
 * the trade-value-vs-cash-value distinction (the whole DropMarket wedge), how
 * we filter fake listings, how the 8 variants are priced, and where a number is
 * observed vs an estimate. That honesty is what makes it the page other people
 * link to and AI answer-engines cite — so it's written to be quotable.
 */

export const ADOPT_ME_METHODOLOGY_FAQ: { q: string; a: string }[] = [
  {
    q: 'What is the difference between trade value and cash value on DropMarket?',
    a: 'Trade value is the community consensus in points — the number traders use to check whether a swap is fair. Cash value is what a pet actually sells for in real money (USD) on marketplaces. They differ because community point ratings lag real demand, and because cash prices reflect what buyers will genuinely pay today. DropMarket shows both side by side; the cash value is the one that answers "how much is this worth in real money".',
  },
  {
    q: 'How does DropMarket get its Adopt Me cash values?',
    a: 'Cash values are built from real marketplace listings across multiple sources, pooled together and priced at the low end of the clean listings — the cheapest a buyer could realistically get the pet for, not an inflated average. We filter out fake and scam listings before pricing (see below), so the number reflects genuine, trustworthy offers.',
  },
  {
    q: 'How do you filter out fake or scam listings?',
    a: 'Fake listings — a few-cent "add me in-game" bait, brand-new throwaway seller accounts, and duplicated spam — would otherwise drag prices down. We drop listings from very new or low-feedback sellers, reject scam-phrase titles, remove toys and bundles named after a pet, collapse duplicate copies, and discard any price absurdly below the real cluster. Only clean listings from established sellers count toward a value.',
  },
  {
    q: 'How are the eight Adopt Me variants priced?',
    a: 'Each pet exists in eight tradable forms — Normal, Fly, Ride, Fly Ride, Neon, Neon Fly Ride, Mega Neon and Mega Fly Ride. We price the high-volume, clearly-labelled forms (Fly Ride, Neon Fly Ride, Mega Fly Ride) directly from real listings. Where a variant has too few trustworthy listings, its value is shown as a clearly-marked estimate rather than a fabricated number.',
  },
  {
    q: 'What does the confidence label mean?',
    a: 'Each cash value carries a confidence label based on how many clean, comparable listings support it: highly accurate (25+), high (10+), medium (3+), and low below that. A pet with only a couple of real listings will say so rather than pretend to precision it does not have.',
  },
  {
    q: 'How often are Adopt Me values updated?',
    a: 'Prices refresh daily from live marketplace data, and the pet catalogue refreshes weekly so pets and eggs from Adopt Me’s Friday updates are picked up automatically. Each value reflects recent activity, not a one-time hand-edited list.',
  },
]

export default async function AdoptMeMethodology() {
  const hubNav = await getHubNavData('adopt-me')

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Adopt Me', path: '/adopt-me' },
          { name: 'Values', path: '/adopt-me/values' },
          { name: 'Methodology', path: '/adopt-me/values/methodology' },
        ])}
      />
      <JsonLd data={faqPage(ADOPT_ME_METHODOLOGY_FAQ)} />

      <GameHeroBackdrop gameSlug="adopt-me" size="hub">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
            <Link href="/adopt-me/values" className="transition-colors hover:text-text-primary">Values</Link>
            <CaretRightIcon size={12} weight="bold" aria-hidden />
            <span className="text-text-secondary">Methodology</span>
          </nav>

          <p className={`mb-2 ${VALUE_LABEL}`}>DropMarket Value Database</p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
            How we value Adopt Me pets
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Adopt Me is the only Roblox trading economy where you can ask two
            different questions about a pet: what is it worth in a trade, and
            what is it worth in real money? DropMarket answers both — and this
            page explains exactly how, so you can trust the number and cite it.
          </p>
        </div>
      </GameHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <HubSection title="Trade value vs cash value — why we show both">
          Every incumbent Adopt Me value site publishes one number: an abstract
          community <em>trade value</em> in points. That is useful for checking
          whether a swap is fair, but it cannot tell you what a pet is worth in
          real money — because those sites do not process transactions.
          DropMarket does. So every pet shows two numbers: the community{' '}
          <strong className="text-[#E8BD6A]">trade value</strong>, and the
          DropMarket <strong className="text-[#54DDBE]">cash value in USD</strong>,
          built from real marketplace activity. They diverge because point
          ratings lag real demand — and that gap is exactly what you want to see
          before you accept an offer or decide to sell.
        </HubSection>

        <HubSection title="Real listings, priced at the low end">
          Cash values come from real marketplace listings, pooled across multiple
          sources. Rather than an inflated average, we price at the{' '}
          <strong className="text-text-primary">low end of the clean listings</strong>{' '}
          — the cheapest a buyer could realistically get the pet for. More
          sources mean more samples and a more honest floor.
        </HubSection>

        <HubSection title="Filtering out fakes and scams">
          Raw marketplace data is full of noise that would distort a price if we
          let it through. Before anything is priced we remove:
          <ul className="mt-3 space-y-1.5">
            <li>• <strong className="text-text-primary">Scam bait</strong> — a few-cent
              &ldquo;add me in-game / friend request&rdquo; listings that are not real sales.</li>
            <li>• <strong className="text-text-primary">Untrustworthy sellers</strong> —
              brand-new accounts and sellers with little completed-order history.</li>
            <li>• <strong className="text-text-primary">Toys and bundles</strong> named after
              a pet (strollers, plushies, multi-pet packs) — these are different items.</li>
            <li>• <strong className="text-text-primary">Duplicate spam</strong> — one seller
              posting the same listing many times counts once, not many.</li>
            <li>• <strong className="text-text-primary">Absurd outliers</strong> — any price
              far below the real cluster is treated as a fake, not a deal.</li>
          </ul>
        </HubSection>

        <HubSection title="How the eight variants are priced">
          A single pet exists in eight tradable forms — Normal, Fly, Ride, Fly
          Ride, Neon, Neon Fly Ride, Mega Neon and Mega Fly Ride. Fly Ride (FR)
          is the standard benchmark traders quote. We price the high-volume,
          clearly-labelled forms directly from real listings; where a variant
          has too few trustworthy listings, we show a clearly-marked{' '}
          <em>estimate</em> derived from the variant ladder rather than inventing
          a precise number. We never present an estimate as an observed sale.
        </HubSection>

        <HubSection title="Confidence, and what we exclude">
          Every cash value carries a confidence label from the number of clean
          listings behind it — highly accurate (25+), high (10+), medium (3+),
          low below that. We exclude bundles, account sales, disputed orders,
          toys, and mislabelled variants. A pet we cannot price honestly shows an
          estimate, not a guess dressed up as a fact.
        </HubSection>

        <HubSection title="Why you can trust and cite these numbers">
          Because the data is real, dated, refreshed daily, and openly filtered,
          DropMarket values are designed to be the reference the community links
          to — and the source an AI assistant can quote. Each value states itself
          as plain, dated text, so it stays accurate whether it is read by a
          person, Google, or an answer engine.
        </HubSection>

        {/* FAQ sits on the page ground (not inside a card): the FAQ cards are
            surfaces themselves, and a card inside a card is off-system. */}
        <section className="pt-2">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            Methodology — frequently asked questions
          </h2>
          <FaqCards items={ADOPT_ME_METHODOLOGY_FAQ} square defaultOpen={0} className="mt-4" />
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/adopt-me/values" className={VALUE_BTN_SECONDARY}>
            Browse all Adopt Me values
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
        </div>
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
