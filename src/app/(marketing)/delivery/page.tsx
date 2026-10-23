/**
 * /delivery: how digital goods reach the buyer, for buyers and for a payment
 * provider's site review (2026-10-23). Benchmarked on Eldorado's one line
 * per delivery method plus protection table, and Gameflip's key timeframes
 * and "late or not delivered" steps. The protection windows and the dispute
 * window are read live (order_completion_windows / platform_fee_settings,
 * the same read /sell/fees uses), never typed in. ISR, anon + service-role
 * server reads only, no cookie client.
 */
import type { Metadata } from 'next'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/ssr/ChatCircleDots'
import { ClockCountdownIcon } from '@phosphor-icons/react/dist/ssr/ClockCountdown'
import { GameControllerIcon } from '@phosphor-icons/react/dist/ssr/GameController'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { TimerIcon } from '@phosphor-icons/react/dist/ssr/Timer'
import { UserCheckIcon } from '@phosphor-icons/react/dist/ssr/UserCheck'
import Link from '@/components/navigation/AppLink'
import { FactStrip, InfoCtaBand, InfoHero, InfoSection, InfoTable, type Fact } from '@/components/info'
import { getPublicWithdrawalTerms } from '@/lib/fees/public-rates'
import { CANCEL_REQUEST_MIN_DELIVERY_HOURS, hoursAsDays } from '@/lib/legal/protection-windows'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'How Delivery Works',
  description:
    'How in-game items, currency and accounts are delivered on DropMarket, how long you have to check an order, and what happens if it is late.',
  alternates: { canonical: '/delivery' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'How Delivery Works on DropMarket',
    description: 'In-game delivery, protection windows and what happens if an order is late.',
    url: '/delivery',
    type: 'website',
  },
})

const link = 'font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70'

const FACTS: Fact[] = [
  { icon: GameControllerIcon, tone: 'lime', title: 'Digital Only', body: 'Nothing is shipped. Delivery happens in the game.' },
  { icon: TimerIcon, tone: 'blue', title: 'Time on Every Listing', body: 'Each seller states a delivery time before you pay.' },
  { icon: ChatCircleDotsIcon, tone: 'neutral', title: 'Tracked in Your Order', body: 'Your order page shows each step and the seller chat.' },
  { icon: ShieldCheckIcon, tone: 'green', title: 'Covered by SafeDrop', body: 'Not delivered? You get your money back.', href: '/safedrop' },
]

const BY_PRODUCT: { key: string; cells: React.ReactNode[] }[] = [
  { key: 'items', cells: ['In-game items and pets', 'The seller trades or gifts the item in the game. Join their server or accept their trade when they message you.'] },
  { key: 'currency', cells: ['In-game currency', 'Sent in the game by trade, gift or the method the listing describes.'] },
  { key: 'account', cells: ['Game accounts', 'Login details arrive in the order chat. Change the password and email straight away.'] },
  { key: 'top_up', cells: ['Top-ups and gift cards', 'A top-up to your account or a code in the order chat, as the listing says.'] },
]

const YOUR_PART = [
  'Give the right username, server or region at checkout.',
  'Be online around the delivery time and reply in the order chat.',
  'Check what you received before you confirm the order.',
  'Keep everything in the order chat, so SafeDrop Protection covers it.',
]

export default async function DeliveryPage() {
  const terms = await getPublicWithdrawalTerms()
  // Boosting is switched off site-wide, so its window isn't listed.
  const windows = terms.windows.filter((w) => w.type !== 'service')

  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Delivery', path: '/delivery' }])} />

      <InfoHero
        icon={PackageIcon}
        tone="lime"
        title="How Delivery Works"
        lead="Everything on DropMarket is digital. Sellers deliver in the game or hand over an account, and every order is covered by SafeDrop Protection."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip label="Delivery at a glance" items={FACTS} className="mt-12 sm:mt-14" />

        <InfoSection id="by-product" icon={PackageIcon} tone="lime" title="Delivery by Product">
          <InfoTable
            caption="How each product type is delivered"
            columns={[
              { key: 'product', label: 'Product' },
              { key: 'how', label: 'How it arrives' },
            ]}
            rows={BY_PRODUCT}
          />
        </InfoSection>

        <InfoSection id="your-part" icon={UserCheckIcon} tone="blue" title="Your Part">
          <ul className="max-w-[72ch] space-y-2.5 text-body text-text-secondary">
            {YOUR_PART.map((line) => (
              <li key={line} className="flex gap-3">
                <UserCheckIcon size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-text-tertiary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection
          id="protection"
          icon={ShieldCheckIcon}
          tone="green"
          title="Time to Check Your Order"
          sub="After delivery, the order completes on its own when this window closes, unless you confirm or open a dispute first."
        >
          <InfoTable
            caption="Protection window after delivery, by product type"
            columns={[
              { key: 'product', label: 'Product' },
              { key: 'window', label: 'Window after delivery', align: 'right' },
            ]}
            rows={windows.map((w) => ({ key: w.type, cells: [w.label, hoursAsDays(w.hours)] }))}
            className="max-w-3xl"
          />
          <p className="mt-4 max-w-[72ch] text-body-sm text-text-secondary">
            You can open a dispute for {terms.disputeWindowDays} days from delivery, whether or not the order has completed.
          </p>
        </InfoSection>

        <InfoSection id="late" icon={ClockCountdownIcon} tone="amber" title="Late or Not Delivered">
          <div className="max-w-[72ch] space-y-4 text-body text-text-secondary">
            <p>
              If the seller hasn’t delivered by the time on the listing, open a dispute from your order page. For listings with a delivery time
              of {CANCEL_REQUEST_MIN_DELIVERY_HOURS} hours or more, you can also ask us to cancel before the order is marked delivered.
            </p>
            <p>
              An order that isn’t delivered is refunded: as store credit straight away, or the full amount back to your payment method if you
              ask. The details are in the{' '}
              <Link href="/refunds" className={link}>
                Refund &amp; Dispute Policy
              </Link>
              .
            </p>
          </div>
        </InfoSection>

        <InfoCtaBand
          icon={StorefrontIcon}
          tone="lime"
          title="Find Your Next Order"
          body="Compare sellers by price, rating and delivery time."
          action={{ href: '/browse', label: 'Browse Listings' }}
        />
      </div>
    </main>
  )
}
