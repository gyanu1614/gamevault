/**
 * /safedrop: what SafeDrop Protection covers and how a claim works.
 *
 * Redesigned 2026-10-15 (owner: the old look, less text, organised, the new
 * UI): hero, four facts, how it works, covered / not covered, the windows
 * table, the dispute timeline, the seller line, reviews (only with 10+ real
 * ones), FAQ, one closing CTA. Static; every number from the legal module.
 */
import type { Metadata } from 'next'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { FileTextIcon } from '@phosphor-icons/react/dist/ssr/FileText'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { TimerIcon } from '@phosphor-icons/react/dist/ssr/Timer'
import { PathIcon } from '@phosphor-icons/react/dist/ssr/Path'
import Link from '@/components/navigation/AppLink'
import { FactStrip, InfoCtaBand, InfoHero, InfoSection, StepsRow } from '@/components/info'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { ValueCallout } from '@/components/values/ValueCallout'
import { VALUE_BTN_SECONDARY } from '@/components/values/styles'
import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'
import { cn } from '@/lib/utils'
import { HOW_STEPS, SAFEDROP_FACTS, SAFEDROP_FAQ, SAFEDROP_LEAD } from './_content'
import { Coverage } from './_Coverage'
import { WindowsTable } from './_WindowsTable'
import { DisputeTimeline } from './_DisputeTimeline'

export const metadata: Metadata = seoMeta({
  title: 'SafeDrop Protection',
  description:
    "SafeDrop Protection is included on every DropMarket order. Not delivered or not as described? You get a full refund. See what's covered and how disputes work.",
  alternates: { canonical: '/safedrop' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'SafeDrop Protection',
    description: 'SafeDrop Protection on every DropMarket order. Get what you ordered, or your money back.',
    type: 'website',
  },
})

export default function SafeDropPage() {
  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={faqPage(SAFEDROP_FAQ)} />
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'SafeDrop Protection', path: '/safedrop' }])} />

      <InfoHero icon={ShieldCheckIcon} tone="blue" title="SafeDrop Protection" lead={SAFEDROP_LEAD}>
        <Link href="/safedrop-policy" className={cn(VALUE_BTN_SECONDARY, 'group h-11 px-5 text-body-sm')}>
          <FileTextIcon size={16} weight="duotone" aria-hidden />
          Read the SafeDrop Terms
        </Link>
      </InfoHero>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip label="Why SafeDrop is safe" items={SAFEDROP_FACTS} className="mt-12 sm:mt-14" />

        <InfoSection id="how-it-works" icon={PathIcon} tone="blue" title="How SafeDrop Works" sub="Three steps on every order, automatic.">
          <StepsRow steps={HOW_STEPS} tone="blue" />
          <ValueCallout tone="blue" icon={TimerIcon} title="Forgot to confirm?" className="mt-3">
            The order completes by itself when its protection window ends.
          </ValueCallout>
        </InfoSection>

        <InfoSection id="covered" icon={ShieldCheckIcon} tone="green" title="What SafeDrop Covers" sub="Clear rules, no small print.">
          <Coverage />
        </InfoSection>

        <InfoSection
          id="windows"
          icon={TimerIcon}
          tone="amber"
          title="Protection Windows"
          sub="How long you have to check your order and raise an issue."
        >
          <WindowsTable />
        </InfoSection>

        <InfoSection id="disputes" icon={ScalesIcon} tone="lime" title="How Disputes Work" sub="A fixed process with set times, for both sides.">
          <DisputeTimeline />
        </InfoSection>

        <ValueCallout tone="blue" icon={StorefrontIcon} title="Selling on DropMarket?" className="mt-6">
          The same rules protect you: a claim needs evidence, and both sides get the same steps.{' '}
          <Link href="/sell/fees" className="inline-flex items-center gap-1 font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70">
            Seller Fees and Payouts
            <ArrowRightIcon size={12} weight="bold" aria-hidden />
          </Link>
        </ValueCallout>

        {/* Reviews only once there are 10+ real ones (set on /admin): no
            "trusted by" claim before there is proof. */}
        <TrustpilotGate>
          <section aria-labelledby="safedrop-reviews" className="mt-16 text-center sm:mt-20">
            <h2 id="safedrop-reviews" className="text-subheading font-bold text-text-primary sm:text-heading">
              What Buyers Say
            </h2>
            <div className="mt-6 flex justify-center">
              <TrustpilotShowcase />
            </div>
          </section>
        </TrustpilotGate>

        <HubFaqSection
          title="SafeDrop Protection FAQ"
          subtitle="Short answers. The full rules are in the SafeDrop Protection Terms."
          items={SAFEDROP_FAQ}
        />

        <InfoCtaBand
          icon={ShieldCheckIcon}
          tone="blue"
          title="Shop With SafeDrop Protection"
          body="Every order, every game. Get what you ordered, or your money back."
          action={{ href: '/browse', label: 'Browse the Marketplace' }}
        />
      </div>
    </main>
  )
}
