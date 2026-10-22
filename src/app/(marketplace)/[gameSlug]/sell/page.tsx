/**
 * /[game]/sell — public "Sell your <game> for cash" SEO landing page.
 *
 * The seller-intent counterpart to /values and /calculator: it targets queries
 * like "sell steal a brainrot for money / cash out adopt me pets" and explains
 * how selling on DropMarket works, then routes to the founding-seller waitlist
 * (join) or the become-seller wizard (apply now). /sell/new stays the actual
 * listing flow — this page is the top-of-funnel that ranks and that we can DM
 * a lead. Public + works logged-out (no auth).
 *
 * Game-agnostic: renders for EVERY active game, not just the two with a
 * content hub. Phase 1 · Step 1 — the seeded `listed` catalogue's hubs stay
 * noindex until they have inventory, so this seller-intent page is what
 * carries their SEO; it is complete with zero listings because it targets
 * sellers, not buyers. Games with a content theme keep their per-game accent
 * and top-values teaser; everything else renders on DEFAULT_THEME with the
 * teaser absent. Cash claims stay honest per game.
 *
 * Data-led (values platform Step E, owner 2026-10-21): each section renders
 * only when its game has the data (_sellData.ts) — the items players sell and
 * what they sell for (values hubs), live offers per category, players online —
 * and the title, description and FAQ are written from the same numbers
 * (lib/sell/sell-copy.ts). No fee anywhere: sellers see it when they list.
 */

import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { IconRosetteDiscountCheck, IconShieldCheck, IconSearch, IconArrowRight, IconCheck, IconUserPlus, IconListDetails, IconCash } from '@tabler/icons-react'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { isGameSellPageIndexable } from '@/lib/games/indexability'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme, CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'
import { sellDescription, sellFaq, sellTitle, type SellCopyInput } from '@/lib/sell/sell-copy'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { SellChoiceModal, SellFinalCta } from './_SellChoiceModal'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { foundingHref } from '@/lib/seo/founding-href'
import { seoMeta } from '@/lib/seo/fit'
import { getGameSellerGuide } from '@/lib/blog/db'
import { loadSellPage } from './_sellData'
import { CheckYourPrice, SellCategories, SellItemGrid, SellPlayers } from './_SellSections'

const AMBER = '#F5C451'

export const revalidate = 3600

/**
 * Prerender only the content-hub games. Every other active game renders on
 * demand and is then cached by `revalidate` — prerendering 230+ seller pages
 * at build time would cost build minutes for pages that are mostly crawled,
 * not browsed.
 */
export function generateStaticParams() {
  return CONTENT_HUB_GAME_SLUGS.map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

/** The copy builder's input, from the page's own data. */
function copyInput(gameSlug: string, data: NonNullable<Awaited<ReturnType<typeof loadSellPage>>>): SellCopyInput {
  return {
    gameSlug,
    name: data.name,
    noun: data.noun,
    tier: data.tier,
    pricedCount: data.pricedCount,
    valuable: data.valuable,
    offers: data.offers,
    categories: data.categories,
    players: data.players,
  }
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const data = await loadSellPage(gameSlug)
  if (!data) return { title: 'Not Found' }

  const indexable = isGameSellPageIndexable({
    enabledCategoryCount: data.game.enabledCategoryCount,
    seoIndexable: data.game.seo_indexable,
  })

  // Bare title — the root layout template appends "| DropMarket". No fee in
  // the title or the description (owner, 2026-10-21).
  const input = copyInput(gameSlug, data)
  const title = sellTitle(input)
  const description = sellDescription(input)

  return {
    title,
    description,
    // A game with no enabled category has nothing to sell, so the page has
    // no reason to rank; it still renders for anyone who lands on it.
    robots: indexable ? undefined : { index: false, follow: true },
    alternates: { canonical: `/${gameSlug}/sell` },
    openGraph: {
      images: DEFAULT_OG_IMAGES,
      title,
      description,
      url: `/${gameSlug}/sell`,
      type: 'website',
    },
  }
}

export default async function SellLandingPage({ params }: PageProps) {
  const { gameSlug } = await params
  const data = await loadSellPage(gameSlug)
  if (!data) notFound()

  const theme = getGameContentTheme(gameSlug)
  const [hubNav, ctaImage, guide] = await Promise.all([
    getHubNavData(gameSlug),
    // The game's ONE CTA image (admin upload → static art) for both bands.
    getGameCtaImage(gameSlug),
    // The game's seller guide post, linked under How It Works when there is one.
    getGameSellerGuide(gameSlug),
  ])
  const { name, noun } = data
  const hasValues = hasHubPage(gameSlug, 'values')
  // Adopt Me quotes one form per pet; the tiles name it only when it differs.
  const defaultForm = data.top[0]?.form ?? null
  const FAQ = sellFaq(copyInput(gameSlug, data))

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <GameHeroBackdrop gameSlug={gameSlug} size="tall">
        <HubNav data={hubNav} />

        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name, path: `/${gameSlug}` },
            { name: 'Sell', path: `/${gameSlug}/sell` },
          ])}
        />

        {/* Hero — shared HubHero (same type scale + spacing as Values /
            Calculator / Blog); the amber eyebrow and CTA are page-specific
            slots. */}
        <HubHero
          // The H1 follows the title tag (sell-copy sellTitle), in Title Case.
          title={`Sell ${name} ${noun} For Real Money`}
          lead={
            <>
              Got {name} {noun.toLowerCase()} to sell? You&apos;re in the right place. Become a
              seller, list them, make the sale — and cash out. Every payout is
              protected.
            </>
          }
          eyebrow={
            <div className="flex items-center justify-center gap-2.5">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#F5C451]/25 bg-[#F5C451]/10"
                style={{ color: AMBER }}
              >
                <IconRosetteDiscountCheck className="h-[18px] w-[18px]" stroke={2} />
              </span>
              <span className="text-caption font-bold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
                First 100 Sellers · Founding Rate
              </span>
            </div>
          }
        >
          <div className="mt-7 flex items-center justify-center">
            <SellChoiceModal gameName={name} gameSlug={gameSlug}>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[14px] font-semibold text-[#08110B] transition-transform active:scale-[0.99]"
                style={{ background: theme.accent }}
              >
                Start Selling {name}
                <IconArrowRight className="h-4 w-4" stroke={2.2} />
              </button>
            </SellChoiceModal>
          </div>
        </HubHero>

      {/* Body — max-w-7xl page gutter like the other hubs. Stays INSIDE
          GameHeroBackdrop (like Values/Blog) so there's no seam/dark line where
          the hero backdrop would otherwise end. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* What is true for THIS game, richest data first; each block renders only with its data. */}
        {data.players && <SellPlayers players={data.players} />}
        <SellItemGrid
          title={`Top ${name} ${noun} To Sell Now`}
          sub={defaultForm ? `What players are buying, at today's ${defaultForm} price.` : "What players are buying, at today's price."}
          items={data.top}
          defaultForm={defaultForm}
        />
        {data.searchable && data.pricedCount > 0 && (
          <CheckYourPrice gameSlug={gameSlug} name={name} noun={noun} pricedCount={data.pricedCount} accent={theme.accent} />
        )}
        <SellItemGrid title={`Just Added To ${name}`} sub={`New ${noun.toLowerCase()} from the last two weeks.`} items={data.fresh} defaultForm={defaultForm} />
        <SellCategories gameSlug={gameSlug} name={name} categories={data.categories} />

        {/* Why sell here — three cards, wider + separated (gap, not hairline). */}
        <section className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: IconRosetteDiscountCheck,
              title: 'Low Fees, Lowest Commission',
              points: [
                'No listing fees — you pay nothing until an item sells.',
                'One of the lowest seller commissions anywhere.',
                'Founding sellers get a discounted rate for their first year.',
              ],
            },
            {
              icon: IconShieldCheck,
              title: 'Get Paid for Every Order You Deliver',
              points: [
                'Every order is SafeDrop protected.',
                'Deliver as described and you always get paid — no chargebacks.',
                'Withdraw your earnings whenever you want.',
              ],
            },
            {
              icon: IconSearch,
              title: `Free Buyer Traffic, No Upfront Cost`,
              points: [
                // Only a values hub has value pages to point at.
                hasValues ? `Our ${name} value pages rank on Google — buyers find you.` : `Our ${name} pages rank on Google — buyers find you.`,
                'Get free traffic straight to your listings, every day.',
                'Free to join. Costs you nothing to get started.',
              ],
            },
          ].map((c) => (
            <SpotlightCard
              key={c.title}
              glow="green"
              className="border border-[#1A211A] bg-[#0B0F0C]/60 p-5 backdrop-blur-md transition-colors hover:border-[#24352A] sm:p-6"
            >
              {/* Icon (neutral, in a forest chip) beside the title. min-h keeps
                  all three headers the same height even when a title wraps. */}
              <div className="relative flex min-h-[40px] items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#1E2723] bg-[#10160F] text-[#E4EAE2]">
                  <c.icon className="h-[18px] w-[18px]" stroke={1.9} />
                </span>
                <h2 className="text-body-sm font-bold leading-tight text-[#F1F3F1]">{c.title}</h2>
              </div>
              {/* 3 punchy points. */}
              <ul className="relative mt-4 space-y-2.5">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[#B7C0B8]">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8FBF9C]" stroke={2.4} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          ))}
        </section>

        {/* How It Works — steps inside ONE card (not grey dividers). Markers
            are animated amber dots, not pink numbers. Step 1 has in-text apply
            links; step 2 shows a real top-pets grid. */}
        <section className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-heading font-bold tracking-tight text-[#F2F6F0]">
            How It Works
          </h2>
          <div className="mt-6 space-y-6 border border-[#1A211A] bg-[#0B0F0C]/60 p-6 backdrop-blur-md sm:p-8">
            {/* Step 1 — sign up + apply, with both routes as in-text links.
                Marker: meaningful icon in a rectangular chip, aligned to the
                heading via a matched-height flex line-box (no magic margin). */}
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E2723] bg-[#0E1310] text-[#8FBF9C]">
                <IconUserPlus className="h-[16px] w-[16px]" stroke={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex min-h-8 items-center text-[15px] font-bold leading-tight text-[#F1F3F1]">Sign Up &amp; Apply to Sell</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#98A398]">
                  Reserve your spot as a{' '}
                  <Link
                    href={foundingHref(`${gameSlug}-sell-step`)}
                    className="font-semibold text-[#8FBF9C] underline-offset-2 transition-colors hover:text-[#A6D9B6] hover:underline"
                  >
                    founding seller
                  </Link>
                  , or if you&apos;re ready now,{' '}
                  <Link
                    href="/founding#src=game-sell"
                    className="font-semibold text-[#8FBF9C] underline-offset-2 transition-colors hover:text-[#A6D9B6] hover:underline"
                  >
                    become a seller
                  </Link>{' '}
                  and list your first item today.
                </p>
              </div>
            </div>

            {/* Step 2 — list your items (the real items and prices are in the grid above). */}
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E2723] bg-[#0E1310] text-[#8FBF9C]">
                <IconListDetails className="h-[16px] w-[16px]" stroke={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex min-h-8 items-center text-[15px] font-bold leading-tight text-[#F1F3F1]">List Your {name} {noun}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#98A398]">
                  Price against the live market, set a delivery window, and publish.
                  No listing fee — you only pay when something sells.
                </p>
              </div>
            </div>

            {/* Step 3 — deliver + get paid + withdraw. */}
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E2723] bg-[#0E1310] text-[#8FBF9C]">
                <IconCash className="h-[16px] w-[16px]" stroke={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex min-h-8 items-center text-[15px] font-bold leading-tight text-[#F1F3F1]">Deliver &amp; Get Paid</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#98A398]">
                  Make the sale, deliver in-game, and cash out to your payment
                  method. SafeDrop protects every payout — you&apos;re paid even if
                  a buyer disappears.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The game's full seller guide, one slim line under How It Works. */}
        {guide && (
          <p className="mx-auto mt-5 max-w-4xl text-center text-[13.5px] text-[#98A398]">
            New to selling {name}?{' '}
            <Link
              href={`/${gameSlug}/blog/${guide.slug}`}
              className="group inline-flex items-center gap-1 font-semibold text-[#8FBF9C] underline-offset-2 transition-colors hover:text-[#A6D9B6] hover:underline"
            >
              Read the full guide: {guide.title}
              <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" stroke={2.2} />
            </Link>
          </p>
        )}

        {/* Price-it-first — reuse the shared HubCtaBand at full hub width
            (max-w-7xl, like the Values page modal). Only a values hub has a
            values page to send them to. */}
        {hasValues && (
        <div className="mt-16">
          <HubCtaBand
            gameSlug={gameSlug}
            bgSrc={ctaImage}
            title={`Know your ${name} price before you list`}
            body={`Check what your ${name} is really worth, then list to sell at a number that moves.`}
            ctaLabel={`See ${name} Values`}
            ctaHref={`/${gameSlug}/values`}
            className=""
          />
        </div>
        )}

        {/* FAQ — reuse the shared FaqCards accordion (same as calculator page). */}
        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-heading font-bold tracking-tight text-[#F2F6F0]">
            Selling {name} — FAQ
          </h2>
          <FaqCards items={FAQ} defaultOpen={0} square className="mt-5" />
        </section>

        {/* Final CTA band — its button opens the seller choice modal. Rendered
            via the SellFinalCta client wrapper so the modal trigger stays
            client-side. */}
        <div className="mt-16">
          <SellFinalCta gameName={name} gameSlug={gameSlug} accent={theme.accent} bgSrc={ctaImage} />
        </div>
      </div>
      </GameHeroBackdrop>

      <JsonLd data={faqPage(FAQ)} />

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
