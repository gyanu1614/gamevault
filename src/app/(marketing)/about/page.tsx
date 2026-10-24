/**
 * /about: who runs DropMarket and how the marketplace works, for buyers and
 * for a payment provider's site review (2026-10-23). Benchmarked on the
 * competitors' About pages: LootBar's company-information table on the page
 * itself, Gameflip's "independent, not affiliated" line, eBay's restraint.
 * No invented numbers or claims. Static: no DB read, no cookie client.
 */
import type { Metadata } from 'next'
import { BuildingsIcon } from '@phosphor-icons/react/dist/ssr/Buildings'
import { ChatsCircleIcon } from '@phosphor-icons/react/dist/ssr/ChatsCircle'
import { HandshakeIcon } from '@phosphor-icons/react/dist/ssr/Handshake'
import { IdentificationBadgeIcon } from '@phosphor-icons/react/dist/ssr/IdentificationBadge'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import Link from '@/components/navigation/AppLink'
import { CompanyDetails, FactStrip, InfoCtaBand, InfoHero, InfoSection, type Fact } from '@/components/info'
import { COMPANY } from '@/lib/config/company'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'About DropMarket',
  description:
    'DropMarket is a UK marketplace where players buy and sell in-game items, currency and accounts, with SafeDrop Protection on every order.',
  alternates: { canonical: '/about' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'About DropMarket',
    description: 'A UK marketplace for in-game items, currency and accounts, with SafeDrop Protection on every order.',
    url: '/about',
    type: 'website',
  },
})

const link = 'font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70'

const FACTS: Fact[] = [
  { icon: BuildingsIcon, tone: 'blue', title: 'UK Registered Company', body: `${COMPANY.legalName}, company number ${COMPANY.companyNumber}.` },
  { icon: ShieldCheckIcon, tone: 'green', title: 'SafeDrop on Every Order', body: 'Get what you ordered, or your money back.', href: '/safedrop' },
  { icon: StorefrontIcon, tone: 'lime', title: 'Independent Sellers', body: 'Players and stores set their own prices and delivery times.' },
  { icon: HandshakeIcon, tone: 'neutral', title: 'Not Affiliated With Publishers', body: 'Game names and marks belong to their owners.' },
]

export default function AboutPage() {
  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])} />

      <InfoHero
        icon={StorefrontIcon}
        tone="lime"
        title="About DropMarket"
        lead="A marketplace where players buy and sell in-game items, currency and accounts. Every order is covered by SafeDrop Protection."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip label="DropMarket at a glance" items={FACTS} className="mt-12 sm:mt-14" />

        <InfoSection id="how-it-works" icon={HandshakeIcon} tone="blue" title="How DropMarket Works">
          <div className="max-w-[72ch] space-y-4 text-body text-text-secondary">
            <p>
              Sellers list items, currency and accounts for the games they play, and set their own prices and delivery times. Buyers pay at
              checkout, where DropMarket collects the payment as the seller’s agent.
            </p>
            <p>
              The seller delivers in the game. The buyer confirms the order, or it completes on its own when its protection window closes. If
              something goes wrong, the buyer opens a dispute and our team decides it.
            </p>
            <p>
              We earn a commission on each completed sale and a service fee at checkout. Both are shown before anyone pays. The details are in the{' '}
              <Link href="/seller-agreement" className={link}>
                Seller Agency Agreement
              </Link>
              ,{' '}
              <Link href="/fees" className={link}>
                Fees &amp; Charges
              </Link>{' '}
              and{' '}
              <Link href="/safedrop-policy" className={link}>
                SafeDrop Protection Terms
              </Link>
              .
            </p>
          </div>
        </InfoSection>

        <InfoSection
          id="company"
          icon={IdentificationBadgeIcon}
          tone="neutral"
          title="Company Information"
          sub="The details on the UK company register."
        >
          <CompanyDetails className="max-w-3xl" />
        </InfoSection>

        <InfoCtaBand
          icon={ChatsCircleIcon}
          tone="blue"
          title="Questions About DropMarket?"
          body="Help with an order, selling, payouts or anything else."
          action={{ href: '/contact', label: 'Contact Us' }}
        />
      </div>
    </main>
  )
}
