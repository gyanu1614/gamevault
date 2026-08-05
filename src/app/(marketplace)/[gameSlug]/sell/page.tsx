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
 * Game-agnostic: renders for any game with a content hub (hasGameContentTheme),
 * so SAB and Adopt Me both get one from the same file. Forest hub chrome; the
 * per-game accent comes from the content theme. Cash claims stay honest per
 * game (SAB = completed sales; Adopt Me = estimated until sales land).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconRosetteDiscountCheck, IconShieldCheck, IconSearch, IconArrowRight, IconCheck, IconUserPlus, IconListDetails, IconCash } from '@tabler/icons-react'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme, hasGameContentTheme } from '@/lib/content/theme'
import { getHubTopValues } from '../blog/_hubData'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { SellChoiceModal, SellFinalCta } from './_SellChoiceModal'
import { SpotlightCard } from '@/components/ui/spotlight-card'

const AMBER = '#F5C451'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (!hasGameContentTheme(gameSlug)) return { title: 'Not Found' }
  const { name } = getGameContentTheme(gameSlug)

  // Bare title — the root layout template appends "| DropMarket".
  const title = `Sell ${name} for Real Money — Cash Out Safely`
  const description = `Turn your ${name} inventory into real cash. List on DropMarket, get paid through SafeDrop escrow even if a buyer ghosts, and founding sellers lock a lower fee for life. Here's how to start.`

  return {
    title,
    description,
    alternates: { canonical: `/${gameSlug}/sell` },
    openGraph: {
      title: `Sell ${name} for Real Money`,
      description,
      url: `/${gameSlug}/sell`,
      type: 'website',
    },
  }
}

export default async function SellLandingPage({ params }: PageProps) {
  const { gameSlug } = await params
  if (!hasGameContentTheme(gameSlug)) notFound()

  const theme = getGameContentTheme(gameSlug)
  const [hubNav, topPets] = await Promise.all([
    getHubNavData(gameSlug),
    getHubTopValues(gameSlug, 3),
  ])
  const name = theme.name

  const FAQ = [
    {
      q: `How do I sell ${name} for real money?`,
      a: `Join DropMarket as a seller, complete verification, then list your ${name} items with an accurate price and delivery window. When a buyer orders, SafeDrop escrow holds their payment; you deliver in-game, they confirm, and your proceeds are credited to your Seller Balance to withdraw.`,
    },
    {
      q: `What does it cost to sell?`,
      a: `There's no listing fee — you only pay when an item sells, and you keep more of every sale than on the big marketplaces. Founding sellers (the first 100) lock in a lower rate that stays with their account for life, even after full launch.`,
    },
    {
      q: `Is it safe to sell here?`,
      a: `Yes. SafeDrop escrow holds the buyer's payment before you deliver and releases it to you on delivery, so you're protected from buyers who pay then vanish. Every seller is verified, and all communication and delivery stay on-platform where they're covered.`,
    },
    {
      q: `Do I need to verify my identity?`,
      a: `Yes — every seller completes a one-time verification before listing. It's what makes the marketplace safe for buyers and sellers alike, and it's required before any payout.`,
    },
  ]

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <SabHeroBackdrop height={760}>
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
          title={`Sell ${name} For Cash`}
          lead={
            <>
              Got {name} items to sell? You&apos;re in the right place. Become a
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
          SabHeroBackdrop (like Values/Blog) so there's no seam/dark line where
          the hero backdrop would otherwise end. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Why sell here — three cards, wider + separated (gap, not hairline). */}
        <section className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: IconRosetteDiscountCheck,
              title: 'Low Fees, Lowest Commission',
              points: [
                'No listing fees — you pay nothing until an item sells.',
                'One of the lowest seller commissions anywhere.',
                'Founding sellers lock an even lower rate, for life.',
              ],
            },
            {
              icon: IconShieldCheck,
              title: 'Get Paid for Every Order You Deliver',
              points: [
                'Every order is covered by SafeDrop escrow.',
                'Deliver as described and you always get paid — no chargebacks.',
                'Withdraw your earnings whenever you want.',
              ],
            },
            {
              icon: IconSearch,
              title: `Free Buyer Traffic, No Upfront Cost`,
              points: [
                `Our ${name} value pages rank on Google — buyers find you.`,
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
                    href={`/early-seller?src=${gameSlug}-sell-step`}
                    className="font-semibold text-[#8FBF9C] underline-offset-2 transition-colors hover:text-[#A6D9B6] hover:underline"
                  >
                    founding seller
                  </Link>
                  , or if you&apos;re ready now,{' '}
                  <Link
                    href="/account/become-seller"
                    className="font-semibold text-[#8FBF9C] underline-offset-2 transition-colors hover:text-[#A6D9B6] hover:underline"
                  >
                    become a seller
                  </Link>{' '}
                  and pass a quick one-time verification.
                </p>
              </div>
            </div>

            {/* Step 2 — list your pets, with a real top-pets grid (listing table look). */}
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E2723] bg-[#0E1310] text-[#8FBF9C]">
                <IconListDetails className="h-[16px] w-[16px]" stroke={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex min-h-8 items-center text-[15px] font-bold leading-tight text-[#F1F3F1]">List Your {name} Items</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#98A398]">
                  Price against the live market, set a delivery window, and publish.
                  No listing fee — you only pay when something sells.
                </p>
                {topPets.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {topPets.map((pet) => (
                      <div
                        key={pet.slug}
                        className="flex flex-col items-center border border-[#1A211A] bg-[#0E1310] p-3 text-center"
                      >
                        {pet.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={pet.imageUrl}
                            alt={pet.name}
                            loading="lazy"
                            className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                          />
                        ) : (
                          <div className="h-14 w-14 bg-[#151B15] sm:h-16 sm:w-16" />
                        )}
                        <p className="mt-2 line-clamp-1 w-full text-[12px] font-semibold text-[#E4EAE2]">
                          {pet.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[12px] tabular-nums text-[#8FBF9C]">
                          {pet.priceLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Price-it-first — reuse the shared HubCtaBand at full hub width
            (max-w-7xl, like the Values page modal). */}
        <div className="mt-16">
          <HubCtaBand
            gameSlug={gameSlug}
            title={`Know your ${name} price before you list`}
            body={`Check what your ${name} is really worth, then list to sell at a number that moves.`}
            ctaLabel={`See ${name} Values`}
            ctaHref={`/${gameSlug}/values`}
            className=""
          />
        </div>

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
          <SellFinalCta gameName={name} gameSlug={gameSlug} accent={theme.accent} />
        </div>
      </div>
      </SabHeroBackdrop>

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
