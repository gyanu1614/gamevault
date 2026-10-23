/**
 * /contact: where to get help, for buyers, sellers and a payment provider's
 * site review (2026-10-23). Benchmarked on the competitors' contact pages:
 * PlayerAuctions' "start from your order" steps and its "verify it's us"
 * anti-phishing note, G2G's company details next to the channels. One
 * support address, the UK phone line, and the policy pages that have their
 * own process. Static: no DB read, no cookie client.
 */
import type { Metadata } from 'next'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/ssr/ChatCircleDots'
import { EnvelopeIcon } from '@phosphor-icons/react/dist/ssr/Envelope'
import { IdentificationBadgeIcon } from '@phosphor-icons/react/dist/ssr/IdentificationBadge'
import { ReceiptIcon } from '@phosphor-icons/react/dist/ssr/Receipt'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { ShieldWarningIcon } from '@phosphor-icons/react/dist/ssr/ShieldWarning'
import Link from '@/components/navigation/AppLink'
import { CompanyDetails, InfoHero, InfoSection, InfoTable, StepsRow, type Step } from '@/components/info'
import { COMPANY } from '@/lib/config/company'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'Contact DropMarket',
  description: `How to reach DropMarket: help with an order, payments, selling and payouts. Email ${COMPANY.email} or call our UK line.`,
  alternates: { canonical: '/contact' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'Contact DropMarket',
    description: 'Help with an order, payments, selling and payouts.',
    url: '/contact',
    type: 'website',
  },
})

const link = 'font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70'

const ORDER_STEPS: Step[] = [
  {
    icon: ReceiptIcon,
    title: 'Open Your Order',
    body: (
      <>
        Go to{' '}
        <Link href="/account/orders" className={link}>
          your orders
        </Link>{' '}
        and pick the one you need help with.
      </>
    ),
  },
  { icon: ChatCircleDotsIcon, title: 'Message the Seller', body: 'Most delivery questions are sorted in the order chat.' },
  { icon: ShieldWarningIcon, title: 'Open a Dispute', body: 'Not delivered, or not as described? Open a dispute and our team reviews it.' },
]

const mail = (
  <a href={`mailto:${COMPANY.email}`} className={link}>
    {COMPANY.email}
  </a>
)

const CHANNELS: { key: string; cells: React.ReactNode[] }[] = [
  { key: 'help', cells: ['Orders, payments, payouts and your account', mail] },
  {
    key: 'phone',
    cells: [
      'Phone (UK)',
      <a key="p" href={`tel:${COMPANY.phone.replace(/\s+/g, '')}`} className={link}>
        {COMPANY.phone}
      </a>,
    ],
  },
  {
    key: 'complaints',
    cells: [
      'Complaints',
      <Link key="c" href="/complaints" className={link}>
        How we handle complaints
      </Link>,
    ],
  },
  {
    key: 'privacy',
    cells: [
      'Your data and privacy',
      <Link key="pr" href="/privacy" className={link}>
        Privacy Policy
      </Link>,
    ],
  },
  {
    key: 'ip',
    cells: [
      'Copyright and takedown notices',
      <Link key="ip" href="/ip" className={link}>
        IP and takedown process
      </Link>,
    ],
  },
]

const ITS_US = [
  `We only email from addresses ending in @${COMPANY.email.split('@')[1]}.`,
  'We never ask for your password, two-factor code or recovery email.',
  'We never ask you to pay outside DropMarket checkout.',
  'Keep trades and messages in the order chat, so SafeDrop Protection covers them.',
]

export default function ContactPage() {
  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])} />

      <InfoHero
        icon={EnvelopeIcon}
        tone="blue"
        title="Contact DropMarket"
        lead="Order questions are fastest from your order page. For anything else, email us."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <InfoSection id="order-help" icon={ReceiptIcon} tone="green" title="Problem With an Order?" sub="Start from the order itself, so the seller and our team see the details.">
          <StepsRow steps={ORDER_STEPS} tone="green" />
        </InfoSection>

        <InfoSection id="channels" icon={EnvelopeIcon} tone="blue" title="Email and Phone">
          <InfoTable
            caption="How to reach DropMarket"
            columns={[
              { key: 'topic', label: 'For' },
              { key: 'where', label: 'Contact' },
            ]}
            rows={CHANNELS}
            className="max-w-3xl"
          />
        </InfoSection>

        <InfoSection id="its-us" icon={ShieldCheckIcon} tone="amber" title="How to Know It’s Us">
          <ul className="max-w-[72ch] space-y-2.5 text-body text-text-secondary">
            {ITS_US.map((line) => (
              <li key={line} className="flex gap-3">
                <ShieldCheckIcon size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-text-tertiary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection id="company" icon={IdentificationBadgeIcon} tone="neutral" title="Company Details">
          <CompanyDetails className="max-w-3xl" />
        </InfoSection>
      </div>
    </main>
  )
}
