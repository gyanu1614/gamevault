import Link from '@/components/navigation/AppLink'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme } from '@/lib/content/theme'
import { getValuesFreshness } from '@/lib/values/data'
import { HubSection } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_BTN_SECONDARY } from '@/components/values/styles'

/**
 * Methodology for games on the generic values pipeline.
 *
 * Every claim here is checked against what the pipeline actually does. In
 * particular it does NOT say "median" (the model is a reputable-seller
 * cheapest/average pair), does NOT say "completed sales" (we price ACTIVE
 * third-party listings), and states the single-source limitation plainly.
 */

export default async function GenericMethodologyPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const [hubNav, freshness] = await Promise.all([
    getHubNavData(gameSlug),
    getValuesFreshness(gameSlug),
  ])

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <HubNav data={hubNav} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Values', path: `/${gameSlug}/values` },
          { name: 'Methodology', path: `/${gameSlug}/values/methodology` },
        ])}
      />

      <HubHero
        title={`How we price ${theme.name}`}
        lead="Every number on this site comes from real marketplace listings. Here is exactly how, and where the limits are."
      />

      {/* Same column + section card as the other methodology pages. */}
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
        <HubSection title="Where the prices come from">
          <p>
            We crawl live listings on third-party marketplaces every three hours
            and read the asking price and the seller&apos;s review count from
            each one. We currently price{' '}
            <strong className="text-text-primary">
              {freshness.pricedItems}
            </strong>{' '}
            {theme.name} items from{' '}
            <strong className="text-text-primary">
              {freshness.listingCount.toLocaleString('en-US')}
            </strong>{' '}
            listings.
          </p>
          <p>
            These are <strong className="text-text-primary">asking
            prices on active listings</strong>, not completed sales. We do not
            have sales history for {theme.name} yet, and we do not pretend
            otherwise — when we do, this page will say so.
          </p>
        </HubSection>

        <HubSection title="How a value is calculated">
          <p>
            Not an average of everything, and not a median. A listing only
            counts if the seller has enough completed orders to be worth
            trusting — a cheap price from an account with no history is usually
            bait, not a deal. From those reputable listings we publish two
            numbers:
          </p>
          <ul className="ml-4 list-disc space-y-1.5 marker:text-text-tertiary">
            <li>
              <strong className="text-text-primary">Cheapest</strong> — the
              lowest reputable listing that has support above it. A lone low
              price sitting far under everything else is skipped, because it is
              usually a mispriced or different item.
            </li>
            <li>
              <strong className="text-text-primary">Typical</strong> — the
              middle of the cheapest handful of reputable listings: what you
              should actually expect to pay.
            </li>
          </ul>
          <p>
            We also show the real low–high range of the listings behind a value,
            so you can see the spread rather than trusting one number.
          </p>
        </HubSection>

        <HubSection title="What we refuse to publish">
          <p>
            A value needs at least{' '}
            <strong className="text-text-primary">three</strong> reputable
            listings behind it. Below that we publish nothing and the page says
            &quot;no price yet&quot; — we would rather show you a gap than a
            number we cannot stand behind.
          </p>
          <p>
            <strong className="text-text-primary">
              We never price individual pets.
            </strong>{' '}
            In {theme.name}, eggs are sold sealed and by area — what hatches is
            random — so almost no listing names the pet inside. Roughly one in
            sixty does. That is not enough to price a pet honestly, so pet pages
            show the game&apos;s own data (rarity, area, income) and link to the
            egg they hatch from, which does have a real price. Any site showing
            you a precise cash value for every pet is guessing.
          </p>
          <p>
            We also drop listings priced per in-game unit rather than per egg
            (fractions of a cent against millions of claimed stock), because
            they are not comparable with a normal listing on any axis.
          </p>
        </HubSection>

        <HubSection title="How account prices work">
          <p>
            Accounts are priced by income per second, grouped into brackets. We
            publish the{' '}
            <strong className="text-text-primary">
              observed typical price for each bracket
            </strong>{' '}
            rather than a rate per billion/second, because the relationship is
            not linear: doubling an account&apos;s income does not double what
            it sells for. Prices flatten out at the top end, so a per-unit rate
            would badly overprice the biggest accounts and underprice the
            smallest.
          </p>
        </HubSection>

        <HubSection title="Limitations you should know about">
          <p>
            <strong className="text-text-primary">
              We currently use a single marketplace for {theme.name}.
            </strong>{' '}
            The cross-check source we use for other games does not list{' '}
            {theme.name} at all yet. One source means less protection against a
            distorted market, and we would rather tell you than imply a
            consensus that does not exist. We will add a second source as soon
            as one carries the game.
          </p>
          <p>
            Prices move. Every value carries the time it last changed and how
            many listings sit behind it — treat a value with a handful of
            listings as a rough guide, not a quote.
          </p>
        </HubSection>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8">
        <Link href={`/${gameSlug}/values`} className={VALUE_BTN_SECONDARY}>
          <ArrowLeftIcon size={15} weight="bold" aria-hidden />
          All {theme.name} values
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
