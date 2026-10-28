/**
 * /fees: what buyers and sellers pay (redesigned 2026-10-23 from the
 * competitor and best-practice research: PlayerAuctions, G2G, Gameflip,
 * eBay's Buyer Protection fee page, Stripe's local-methods page).
 *
 * Summary first, then detail: hero and four live facts; a $20 worked
 * example; every method grouped by region with the fee on the same item
 * and its terms in words; refunds; seller fees and payouts (live); the
 * processors; FAQ; then the binding fee terms from the legal document, so
 * the full wording stays on one page.
 *
 * Every number is read at render time: the marketplace part and minimum
 * order from platform_fee_settings, each method's sample from THE quote
 * (lib/fees/buyer-fee-overview), payouts from the /sell/fees read. Nothing
 * is typed into copy. Static-first: no cookie client, ISR 24 h, revalidated
 * by the admin buyer-fee and fee-rule writes.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowCounterClockwise'
import { CalculatorIcon } from '@phosphor-icons/react/dist/ssr/Calculator'
import { CreditCardIcon } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { ReceiptIcon } from '@phosphor-icons/react/dist/ssr/Receipt'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import Link from '@/components/navigation/AppLink'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { FactStrip, InfoHero, InfoSection, InfoTable } from '@/components/info'
import { LegalBlockView } from '@/components/legal/LegalBlocks'
import { getBuyerFeeOverview } from '@/lib/fees/buyer-fee-overview'
import { getPublicWithdrawalTerms } from '@/lib/fees/public-rates'
import { payoutFeeText, usd, withdrawalTermsBlocks } from '@/lib/fees/withdrawal-legal'
import { getLegalDoc, type LegalSection } from '@/lib/legal/documents'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'
import { feeFacts, feesFaq, moneyShort } from './_fees-content'
import { MethodsByRegion, WorkedExample } from './_FeeTables'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'Fees & Charges',
  description:
    'What you pay on DropMarket: one service fee at checkout, shown before you pay, with the fee for every payment method. Sellers pay a commission only when a sale completes.',
  alternates: { canonical: '/fees' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'DropMarket Fees & Charges',
    description: 'One service fee at checkout, shown before you pay. Fees for every payment method, refunds and seller payouts.',
    url: '/fees',
    type: 'website',
  },
})

const link = 'font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70'

/** The legal document's sections by heading (the intro has none). */
function sections(all: LegalSection[], heads: Array<string | undefined>): LegalSection[] {
  return heads.map((h) => all.find((s) => s.h === h)).filter((s): s is LegalSection => !!s)
}

export default async function FeesPage() {
  const doc = getLegalDoc('fees')
  if (!doc) notFound()
  const [o, w] = await Promise.all([getBuyerFeeOverview(), getPublicWithdrawalTerms()])
  const faq = feesFaq(o)
  const [processors, security] = sections(doc.sections, ['Payment processors', 'Payment security'])
  const withdrawals = sections(doc.sections, ['Withdrawals'])[0]
  const terms = sections(doc.sections, [undefined, 'Seller commissions', 'Buyer fee', 'Warranties'])

  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={faqPage(faq)} />
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Fees & Charges', path: '/fees' }])} />

      <InfoHero
        icon={ReceiptIcon}
        tone="lime"
        title="Fees & Charges"
        lead="Buyers pay one service fee at checkout and see the exact total before they pay. Sellers pay a commission only when a sale completes."
      >
        <p className="mt-4 text-caption text-text-tertiary">
          Last updated {doc.lastUpdated} · {doc.version}
        </p>
      </InfoHero>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip label="Fees at a glance" items={feeFacts(o)} className="mt-12 sm:mt-14" />

        <InfoSection
          id="example"
          icon={CalculatorIcon}
          tone="blue"
          title={`A ${moneyShort(o.subtotalMinor)} Item, Three Ways`}
          sub="The service fee is the marketplace part plus the processing part for the method you pick."
        >
          <WorkedExample o={o} />
        </InfoSection>

        <InfoSection
          id="by-method"
          icon={CreditCardIcon}
          tone="green"
          title="Fees by Payment Method"
          sub={`The service fee on a ${moneyShort(o.subtotalMinor)} item. Checkout quotes your exact order before you pay, and only offers the methods for your country.`}
        >
          <MethodsByRegion o={o} />
        </InfoSection>

        <InfoSection id="refunds" icon={ArrowCounterClockwiseIcon} tone="amber" title="Refunds and the Service Fee">
          <div className="max-w-[72ch] space-y-4 text-body text-text-secondary">
            <p>
              A refund goes to your store credit for the item price straight away. If your payment method supports refunds, you can ask for the
              full amount you paid, service fee included, to go back to it instead. Methods marked “Store credit only” above, and crypto, are
              refunded as store credit.
            </p>
            <p>
              The details are in the{' '}
              <Link href="/refunds" className={link}>
                Refund &amp; Dispute Policy
              </Link>
              .
            </p>
          </div>
        </InfoSection>

        <InfoSection
          id="sellers"
          icon={StorefrontIcon}
          tone="lime"
          title="Seller Fees and Payouts"
          sub="Commission comes off the item price when an order completes. There is no listing fee."
          aside={
            <Link href="/sell/fees" className={link}>
              Every seller rate
            </Link>
          }
        >
          <InfoTable
            caption="Payout methods with their fee and minimum withdrawal"
            columns={[
              { key: 'method', label: 'Payout method' },
              { key: 'fee', label: 'Fee', align: 'right' },
              { key: 'min', label: 'Minimum withdrawal', align: 'right' },
            ]}
            rows={w.methods.map((m) => ({ key: m.name, cells: [m.displayName, payoutFeeText(m), usd(m.minWithdrawal)] }))}
            className="max-w-3xl"
          />
          <div className="mt-6 max-w-[72ch] space-y-4">
            <LegalBlockView block={withdrawalTermsBlocks(w)[1]} />
            {withdrawals?.blocks.slice(1).map((b, i) => <LegalBlockView key={i} block={b} />)}
          </div>
        </InfoSection>

        <InfoSection id="processors" icon={ShieldCheckIcon} tone="neutral" title="Payment Processors and Security">
          <div className="max-w-[72ch] space-y-4">
            {[processors, security].flatMap((s) => s?.blocks ?? []).map((b, i) => (
              <LegalBlockView key={i} block={b} />
            ))}
          </div>
        </InfoSection>

        <HubFaqSection title="Fees FAQ" subtitle="Quick answers about the service fee, refunds and payouts." items={faq} />

        <InfoSection id="terms" icon={ScalesIcon} tone="neutral" title="Fee Terms" sub="The binding wording, part of the Terms of Use.">
          <div className="max-w-[72ch] space-y-8">
            {terms.map((s, i) => (
              <section key={s.h ?? i} className="space-y-4">
                {s.h && <h3 className="text-body font-semibold text-text-primary">{s.h}</h3>}
                {s.blocks.map((b, j) => (
                  <LegalBlockView key={j} block={b} />
                ))}
              </section>
            ))}
          </div>
        </InfoSection>
      </div>
    </main>
  )
}
