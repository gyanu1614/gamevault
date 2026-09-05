import Link from 'next/link'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { ValuesSeo, valuesFaq } from './_ValuesSeo'
import { SabHeroBackdrop } from './_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { HubHero } from '@/components/content/HubHero'
import AdoptMeValuesClient from './_AdoptMeValuesClient'
import { getAdoptMePets } from './_adoptMeData'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { HubGuidesStrip } from '@/components/content/HubGuidesStrip'

/**
 * /adopt-me/values — the Adopt Me pillar page. Kept as its own component so the
 * SAB values page stays untouched; the shared route delegates here for
 * gameSlug === 'adopt-me'. Same hub chrome (nav, backdrop, footer), Adopt-Me
 * data + client.
 */

const linkCls =
  'text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]'

/**
 * Adopt Me's own intro copy for ValuesSeo — plain-English, written for a player
 * to actually read (the shared default leaned on trader jargon like "aggregated
 * across sources, cleaned of outliers, confidence label"). Still keyword-rich
 * and answer-first for the "adopt me values" head term.
 */
const ADOPT_ME_VALUES_INTRO: { heading: string; body: React.ReactNode }[] = [
  {
    heading: 'What Is Your Adopt Me Pet Worth?',
    body: (
      <>
        That question is the whole reason this page exists. Every pet here has a
        price in real US dollars — not made-up &quot;value points,&quot; but what
        people are actually paying right now, updated every day. Look up any pet
        to see what it&apos;s worth, what its rarer Neon and Mega forms go for, and
        whether its price is climbing or falling. Weighing up a trade instead of a
        purchase? Drop both sides into the{' '}
        <Link href="/adopt-me/calculator" className={linkCls}>
          WFL calculator
        </Link>{' '}
        and it&apos;ll tell you if you&apos;re winning.
      </>
    ),
  },
  {
    heading: 'How We Price The Pets',
    body: (
      <>
        We watch what pets actually sell for across the marketplace and take the
        cheapest price a trusted seller is offering — someone with hundreds of
        completed orders, not a brand-new account posting a fake price. That number
        refreshes daily, so when a pet gets rarer after an event or a trend takes
        off, the value keeps up instead of sitting stale for months like most value
        lists. If you want the exact details, it&apos;s all on the{' '}
        <Link href="/adopt-me/values/methodology" className={linkCls}>
          pricing methodology
        </Link>{' '}
        page.
      </>
    ),
  },
  {
    heading: 'Why The Same Pet Can Be Worth Wildly Different Amounts',
    body: (
      <>
        In Adopt Me a pet&apos;s value isn&apos;t just about which pet it is — it&apos;s
        about what&apos;s been done to it. A plain Bat Dragon and a Mega Neon Fly
        Ride Bat Dragon are the same animal but worlds apart in price, because a
        Neon takes four full-grown pets to make and a Mega takes four Neons.
        Rarity and how much people still want it do the rest. Every variant here is
        priced on its own, so once you know what you&apos;ve got you can{' '}
        <Link href="/adopt-me/buy-items" className={linkCls}>
          buy the pet you want
        </Link>{' '}
        at a fair price — or list your own — with SafeDrop covering every trade.
      </>
    ),
  },
]

export default async function AdoptMeValuesPage() {
  const [pets, hubNav] = await Promise.all([
    getAdoptMePets(),
    getHubNavData('adopt-me'),
  ])

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <SabHeroBackdrop>
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Adopt Me', path: '/adopt-me' },
            { name: 'Values', path: '/adopt-me/values' },
          ])}
        />
        {/* ItemList — helps Google read this as a ranked list of pet value
            pages. Only pets that HAVE a page are listed (others aren't crawlable
            targets), ordered by their top trade value. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Adopt Me Pet Value List',
            itemListElement: pets
              .filter((p) => p.hasPage)
              .sort((a, b) => b.topTradeValue - a.topTradeValue)
              .slice(0, 50)
              .map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}/adopt-me/values/${p.slug}`,
                name: p.name,
              })),
          }}
        />
        {/* FAQPage — mirrors the visible FAQ rendered by ValuesSeo below. */}
        {pets.length > 0 && (
          <JsonLd
            data={faqPage(valuesFaq({ gameName: 'Adopt Me', unit: 'pet' }))}
          />
        )}

        <section>
          <HubHero
            title="Adopt Me Value List"
            lead={
              <>
                What every pet is worth — in community trade value and in real
                money. Pick a variant to reprice the whole list; Fly Ride is the
                trading benchmark.
              </>
            }
          />
        </section>

        {/* The list MUST live inside SabHeroBackdrop: the backdrop is an
            absolutely-positioned band and only its `relative z-10` children
            stack above it. A section placed after </SabHeroBackdrop> fell under
            the band's dark overlay, hiding the variant selector and search. */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          {pets.length === 0 ? (
            <div className="border border-[#2E2338] bg-[#120E15] px-6 py-12 text-center">
              <h2 className="text-xl font-semibold text-[#F1F3F1]">
                Values are temporarily unavailable
              </h2>
              <p className="mt-2 text-[#9BA8A0]">
                The Adopt Me pet database could not be loaded. Please check again
                shortly.
              </p>
            </div>
          ) : (
            <AdoptMeValuesClient pets={pets} />
          )}

          {/* SEO content package — intro, "how we price", rendered FAQ (schema
              above). Depth for the "adopt me value list" head term. Adopt Me
              passes a warmer, plain-English intro (the default copy read too
              jargon-heavy — "aggregated across sources, cleaned of outliers"). */}
          {pets.length > 0 && (
            <ValuesSeo
              gameSlug="adopt-me"
              gameName="Adopt Me"
              unit="pet"
              buyHref="/adopt-me/buy-items"
              intro={ADOPT_ME_VALUES_INTRO}
            />
          )}

          {/* Shared end-of-page CTA with the per-game background hero. */}
          <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref="/adopt-me/buy-items" />
        </section>

        {/* Guides strip — flows value-page equity into Adopt Me blog content
            (self-hides until the game has tagged posts). */}
        <div className="pt-12">
          <HubGuidesStrip
            gameSlug="adopt-me"
            heading="Guides For Pricing & Trading Adopt Me"
          />
        </div>
      </SabHeroBackdrop>

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
