/**
 * /sell/fees: the public seller commission schedule (fee engine PR 5, D3;
 * docs/design/fee-engine.md §4.1, §4.2, §9 A7/A13).
 *
 * Every number on this page is the resolver's answer with p_seller_id NULL,
 * the headline rate before any seller's founding or rank adjustment, read
 * through lib/fees/public-rates (anon client, unstable_cache under
 * FEE_RULES_TAG). An admin fee write revalidates it; the 24 h `revalidate` is
 * the backstop. /fees stays the legal document (rules, not numbers) and links
 * here. Static-first: no cookie client, no searchParams, force-static.
 *
 * Redesigned 2026-10-15 (owner: the old look, organised, the new UI): hero
 * and four live facts, category table beside "Lower Your Rate", per-game
 * table, getting paid, FAQ, one founding CTA. Stays a zero-argument async
 * page with no async children: fee-copy.guard renders it.
 */
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import type { Metadata } from 'next'
import { GameControllerIcon } from '@phosphor-icons/react/dist/ssr/GameController'
import { HandCoinsIcon } from '@phosphor-icons/react/dist/ssr/HandCoins'
import { PercentIcon } from '@phosphor-icons/react/dist/ssr/Percent'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr/Sparkle'
import { WalletIcon } from '@phosphor-icons/react/dist/ssr/Wallet'
import Link from '@/components/navigation/AppLink'
import { FactStrip, InfoCtaBand, InfoHero, InfoSection } from '@/components/info'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { getPublicFeeSchedule, getPublicWithdrawalTerms } from '@/lib/fees/public-rates'
import { foundingHref } from '@/lib/seo/founding-href'
import { seoMeta } from '@/lib/seo/fit'
import { feeFacts, pct, sellFeesFaq } from './_fees-content'
import { CategoryTable, PerGameAside, PerGameTable } from './_RateTables'
import { LowerRate } from './_LowerRate'
import { GettingPaid } from './_GettingPaid'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'Seller Fees',
  description:
    'What it costs to sell on DropMarket: commission by category, per-game rates, rank discounts, the founding-seller programme and payout methods. Read live from the fee table checkout uses.',
  alternates: { canonical: '/sell/fees' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'Seller Fees on DropMarket',
    description: 'Commission by category, per-game rates, rank discounts and payouts. No listing fee, ever.',
    url: '/sell/fees',
    type: 'website',
  },
})

export default async function SellerFeesPage() {
  const [s, w] = await Promise.all([getPublicFeeSchedule(), getPublicWithdrawalTerms()])
  const faq = sellFeesFaq(s, w)

  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={faqPage(faq)} />
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Seller Fees', path: '/sell/fees' }])} />

      <InfoHero
        icon={HandCoinsIcon}
        tone="lime"
        title="Seller Fees on DropMarket"
        lead="No listing fee. Commission comes off the item price only, when an order completes. These are the rates checkout uses."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip label="Seller fees at a glance" items={feeFacts(s, w)} className="mt-12 sm:mt-14" />

        <InfoSection
          id="commission"
          icon={PercentIcon}
          tone="green"
          title="Commission by Category"
          sub="The standard rate for each category, before any per-game rate or seller discount."
        >
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
              <CategoryTable s={s} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <LowerRate s={s} />
            </div>
          </div>
        </InfoSection>

        <InfoSection
          id="per-game"
          icon={GameControllerIcon}
          tone="blue"
          title="Per-Game Rates"
          sub="Some game economies carry their own rate. Everything else uses the category rate."
        >
          <div className="grid items-start gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <PerGameTable s={s} />
            </div>
            <div className="min-w-0 lg:col-span-4 lg:self-stretch">
              <PerGameAside s={s} />
            </div>
          </div>
        </InfoSection>

        <InfoSection id="getting-paid" icon={WalletIcon} tone="blue" title="Getting Paid" sub="What each payout method costs, and when a sale can be withdrawn.">
          <GettingPaid w={w} />
        </InfoSection>

        <HubFaqSection
          title="Seller Fees FAQ"
          subtitle="Quick answers about commission, rate changes and withdrawals."
          items={faq}
          footer={
            <p className="text-body-sm text-text-secondary">
              Buyer fees and warranty terms are in{' '}
              <Link href="/fees" className="font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70">
                Fees &amp; Charges
              </Link>
              .
            </p>
          }
        />

        <InfoCtaBand
          icon={SparkleIcon}
          tone="lime"
          title="Become a Founding Seller"
          body={`Pay ${pct(s.founding.discountPct)} less for your first ${s.founding.months} months, then the rank ladder applies.`}
          action={{ href: foundingHref('sell-fees'), label: 'Become a Founding Seller' }}
        />
      </div>
    </main>
  )
}
