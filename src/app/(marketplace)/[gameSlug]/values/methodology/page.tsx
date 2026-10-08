/**
 * /steal-a-brainrot/values/methodology
 *
 * The "how we price" page — an E-E-A-T + AI-citability asset. Competitors
 * (bloxultra, igitems, the SAB value sites) don't publish a methodology, so a
 * clear, honest explanation of how DropMarket collects and calculates values
 * makes us the trustworthy source Google and AI answer engines prefer to cite.
 * Static server-rendered content; part of the Values hub chrome.
 */

import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import AdoptMeMethodology from './_AdoptMeMethodology'
import GenericMethodologyPage from '../_generic/MethodologyPage'
import ValueListMethodology from '../_generic/ValueListMethodology'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueListHub } from '@/lib/values/hub-config'
import { getGameContentTheme } from '@/lib/content/theme'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400
/**
 * Closed set: generateStaticParams lists every slug this route serves, so an
 * unknown slug is a static 404 with no function invocation (Step 7a — the
 * crawl of 233 `/{game}/…` hub URLs was rendering an empty page each).
 */
export const dynamicParams = false

/* Games on the generic values_* pipeline: VALUES_PIPELINE_GAMES (shared). */

/**
 * Prerender the game slug(s) this route serves; every other slug notFound()s
 * below, so there is nothing else to build.
 */
export function generateStaticParams() {
  return contentHubSlugsFor('methodology').map((gameSlug) => ({ gameSlug }))
}

async function generateMetadataRaw({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug === 'adopt-me') {
    return {
      title: 'How DropMarket Values Adopt Me Pets — Methodology',
      description:
        'How DropMarket calculates Adopt Me pet values: trade value vs cash value, real marketplace listings, fake-listing filtering, the 8 variants, confidence scoring and daily updates.',
      alternates: { canonical: '/adopt-me/values/methodology' },
      keywords: [
        'adopt me value methodology',
        'how are adopt me values calculated',
        'adopt me trade value vs cash value',
        'adopt me pet real money value',
        'are adopt me values accurate',
      ],
      openGraph: {
        images: DEFAULT_OG_IMAGES,
        title: 'How DropMarket Values Adopt Me Pets',
        description:
          'Trade value vs cash value, real listings, fake-listing filtering, and how the 8 variants are priced.',
        url: '/adopt-me/values/methodology',
        type: 'article',
      },
    }
  }

  // Value-list hubs (MM2): real money, not value points.
  const listHub = hasHubPage(gameSlug, 'methodology') ? valueListHub(gameSlug) : null
  if (listHub) {
    const theme = getGameContentTheme(gameSlug)
    const title = `How DropMarket Values ${theme.name} Items — Methodology`
    const description = `How DropMarket prices ${theme.name} (${listHub.shortName}) items in real US dollars: live listings, reputable sellers only, cheapest vs market price, the change threshold and daily updates — no community value points.`
    return {
      title,
      description,
      alternates: { canonical: `/${gameSlug}/values/methodology` },
      openGraph: { images: DEFAULT_OG_IMAGES, title, description, url: `/${gameSlug}/values/methodology`, type: 'article' },
    }
  }

  // Games on the generic values pipeline build metadata from config.
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    const theme = getGameContentTheme(gameSlug)
    const title = `How DropMarket Prices ${theme.name} — Methodology`
    return {
      title,
      description: `How DropMarket calculates ${theme.name} values: live marketplace listings, reputable-seller filtering, minimum evidence, why we never price individual pets, and the single-source limitation.`,
      alternates: { canonical: `/${gameSlug}/values/methodology` },
      openGraph: { images: DEFAULT_OG_IMAGES, title, url: `/${gameSlug}/values/methodology`, type: 'article' },
    }
  }

  // Only SAB has a methodology page. Every other game answered
  // `200 + empty body + index,follow` here — a soft 404. See the body.
  if (!hasHubPage(gameSlug, 'methodology')) notFound()
  return {
    title: 'How DropMarket Values Steal a Brainrot Prices — Methodology',
    description:
      'How DropMarket calculates Steal a Brainrot values: live marketplace data sources, daily updates, confidence scoring, sample sizes, and what we exclude.',
    alternates: { canonical: '/steal-a-brainrot/values/methodology' },
    openGraph: {
      images: DEFAULT_OG_IMAGES,
      title: 'How DropMarket Values Steal a Brainrot Prices',
      description:
        'Our pricing methodology — data sources, daily updates, confidence scoring, and exclusions.',
      url: '/steal-a-brainrot/values/methodology',
      type: 'article',
    },
  }
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How often are Steal a Brainrot values updated on DropMarket?',
    a: 'Values are recalculated every day. A scheduled job captures a fresh price snapshot from live marketplace data each morning (UTC), so every value page shows an "as of" date that reflects real, recent activity — not a stale one-time list.',
  },
  {
    q: 'Where does DropMarket get its Steal a Brainrot price data?',
    a: 'Prices are derived from real marketplace listings by reputable sellers across tracked sources, normalized to a single USD cash value per Brainrot and mutation. We prioritize high-value and popular Brainrots and price all of their mutations where data allows.',
  },
  {
    q: 'What does the confidence label on a value mean?',
    a: 'Each value carries a confidence label (high, medium, or low) based on how many recent comparable data points support it. High confidence means many recent samples agree; low confidence means the estimate is drawn from limited data and may move as more sales are seen.',
  },
  {
    q: 'What does DropMarket exclude from its value calculations?',
    a: 'We exclude extreme outlier prices, bundles, account sales, unclear or unverified mutations, test listings, cancelled orders, refunds, and disputes. These would otherwise distort the true cash value of a single, clean item.',
  },
]

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}) {
  const { gameSlug } = await params

  // Adopt Me has its own methodology page (trade-vs-cash wedge, fake filtering).
  if (gameSlug === 'adopt-me') {
    return <AdoptMeMethodology />
  }

  // `return null` here rendered an empty page with a 200 + index,follow —
  // GSC counted /{game}/values/methodology for every other game as a soft
  // 404. A real 404 is the honest answer.
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    if (!hasHubPage(gameSlug, 'methodology')) notFound()
    return valueListHub(gameSlug) ? (
      <ValueListMethodology gameSlug={gameSlug} />
    ) : (
      <GenericMethodologyPage gameSlug={gameSlug} />
    )
  }

  if (!hasHubPage(gameSlug, 'methodology')) {
    notFound()
  }

  const hubNav = await getHubNavData(gameSlug)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
          { name: 'Methodology', path: '/steal-a-brainrot/values/methodology' },
        ])}
      />
      <JsonLd data={faqPage(FAQ)} />

      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />

        {/* pt clears the fixed HubNav. */}
        <div className={`mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
            <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-text-primary">
              Values
            </Link>
            <CaretRightIcon size={12} weight="bold" aria-hidden />
            <span className="text-text-secondary">Methodology</span>
          </nav>

          <p className={`mb-2 ${VALUE_LABEL}`}>DropMarket Value Database</p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
            How we value Steal a Brainrot prices
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            DropMarket Values are built from real marketplace data and refreshed
            every day. This page explains exactly how each price is sourced,
            calculated, dated, and quality-checked — so you can trust the number
            and cite it with confidence.
          </p>
        </div>
      </GameHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <HubSection title="Live marketplace data, updated daily">
          Every DropMarket value comes from real Steal a Brainrot marketplace
          activity — active listings from reputable sellers — not a hand-edited
          list. A scheduled job runs each morning (UTC) and captures a fresh
          price snapshot, so each value page shows an <em>&ldquo;as of&rdquo;</em>{' '}
          date that reflects genuinely recent data. Historical snapshots power the
          price-trend chart on every item page.
        </HubSection>

        <HubSection title="From raw listings to one clean cash value">
          For each Brainrot and mutation, we collect recent comparable data
          points and normalize them to a single USD cash value. We prioritize
          high-value and popular Brainrots and price all of their mutations where
          the data supports it. Base income and mutation multipliers are used to
          estimate variant income when a verified variant-specific value is not
          yet available.
        </HubSection>

        <HubSection title="Confidence scoring">
          No estimate is presented as more certain than the data allows. Each
          value carries a confidence label:
          <ul className="mt-3 space-y-1.5">
            <li>
              <strong className="text-success">High</strong> — many recent
              comparable samples agree on the price.
            </li>
            <li>
              <strong className="text-warning">Medium</strong> — a moderate
              number of samples; the value is reasonable but may move.
            </li>
            <li>
              <strong className="text-text-primary">Low</strong> — limited data; the
              estimate is a best guess and will firm up as more sales are seen.
            </li>
          </ul>
        </HubSection>

        <HubSection title="What we exclude">
          To keep a value representative of a single, clean item, we exclude
          extreme outlier prices, bundles, account sales, unclear or unverified
          mutations, test listings, cancelled orders, refunds, and disputes.
          These would otherwise skew the true cash value.
        </HubSection>

        <HubSection title="Why you can trust and cite these numbers">
          Because the data is proprietary, dated, and refreshed daily, DropMarket
          Values are designed to be the reference the community links to — the
          same way traders quote a value list. Each page states its price as
          plain, dated text so it stays accurate whether it&apos;s read by a
          person, Google, or an AI assistant.
        </HubSection>

        {/* FAQ — visible copy matches the FAQPage JSON-LD above. */}
        <HubSection title="Methodology — frequently asked questions">
          <dl className="space-y-5 pt-1">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-[14.5px] font-semibold text-text-primary">{f.q}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{f.a}</dd>
              </div>
            ))}
          </dl>
        </HubSection>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/steal-a-brainrot/values" className={VALUE_BTN_SECONDARY}>
            Browse all Brainrot values
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
          <Link href="/steal-a-brainrot/calculator" className={VALUE_BTN_SECONDARY}>
            Open the value calculator
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

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
