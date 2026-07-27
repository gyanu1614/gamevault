/**
 * /steal-a-brainrot/values/methodology
 *
 * The "how we price" page — an E-E-A-T + AI-citability asset. Competitors
 * (bloxultra, igitems, the SAB value sites) don't publish a methodology, so a
 * clear, honest explanation of how DropMarket collects and calculates values
 * makes us the trustworthy source Google and AI answer engines prefer to cite.
 * Static server-rendered content; part of the Values hub chrome.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { ValuesHeader } from '../_ValuesHeader'
import { SabHeroBackdrop } from '../_SabHeroBackdrop'
import { SabSubNav } from '../_SabSubNav'

export const revalidate = 86400

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}): Promise<Metadata> {
  const { gameSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') return { title: 'Not Found' }
  return {
    title: 'How DropMarket Values Steal a Brainrot Prices — Methodology',
    description:
      'How DropMarket calculates Steal a Brainrot values: live marketplace data sources, daily updates, confidence scoring, sample sizes, and what we exclude.',
    alternates: { canonical: '/steal-a-brainrot/values/methodology' },
    openGraph: {
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
    a: 'Prices are derived from real marketplace listings and completed sales across tracked sources, normalized to a single USD cash value per Brainrot and mutation. We prioritize high-value and popular Brainrots and price all of their mutations where data allows.',
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
  if (gameSlug !== 'steal-a-brainrot') {
    return null
  }

  return (
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
          { name: 'Methodology', path: '/steal-a-brainrot/values/methodology' },
        ])}
      />
      <JsonLd data={faqPage(FAQ)} />

      <SabHeroBackdrop>
        <ValuesHeader gameName="Steal a Brainrot" buyHref="/steal-a-brainrot/buy-items" />
        <SabSubNav />

        <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-[#6D7A72]">
            <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-[#F1F3F1]">
              Values
            </Link>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-[#E6EAE7]">Methodology</span>
          </nav>

          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
            DropMarket value database
          </p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[32px]">
            How we value Steal a Brainrot prices
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA8A0]">
            DropMarket Values are built from real marketplace data and refreshed
            every day. This page explains exactly how each price is sourced,
            calculated, dated, and quality-checked — so you can trust the number
            and cite it with confidence.
          </p>
        </div>
      </SabHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Section title="Live marketplace data, updated daily">
          Every DropMarket value comes from real Steal a Brainrot marketplace
          activity — active listings and completed sales — not a hand-edited
          list. A scheduled job runs each morning (UTC) and captures a fresh
          price snapshot, so each value page shows an <em>&ldquo;as of&rdquo;</em>{' '}
          date that reflects genuinely recent data. Historical snapshots power the
          price-trend chart on every item page.
        </Section>

        <Section title="From raw listings to one clean cash value">
          For each Brainrot and mutation, we collect recent comparable data
          points and normalize them to a single USD cash value. We prioritize
          high-value and popular Brainrots and price all of their mutations where
          the data supports it. Base income and mutation multipliers are used to
          estimate variant income when a verified variant-specific value is not
          yet available.
        </Section>

        <Section title="Confidence scoring">
          No estimate is presented as more certain than the data allows. Each
          value carries a confidence label:
          <ul className="mt-3 space-y-1.5 text-[#9BA8A0]">
            <li>
              <strong className="text-[#4FB477]">High</strong> — many recent
              comparable samples agree on the price.
            </li>
            <li>
              <strong className="text-[#E0B155]">Medium</strong> — a moderate
              number of samples; the value is reasonable but may move.
            </li>
            <li>
              <strong className="text-[#9BA8A0]">Low</strong> — limited data; the
              estimate is a best guess and will firm up as more sales are seen.
            </li>
          </ul>
        </Section>

        <Section title="What we exclude">
          To keep a value representative of a single, clean item, we exclude
          extreme outlier prices, bundles, account sales, unclear or unverified
          mutations, test listings, cancelled orders, refunds, and disputes.
          These would otherwise skew the true cash value.
        </Section>

        <Section title="Why you can trust and cite these numbers">
          Because the data is proprietary, dated, and refreshed daily, DropMarket
          Values are designed to be the reference the community links to — the
          same way traders quote a value list. Each page states its price as
          plain, dated text so it stays accurate whether it&apos;s read by a
          person, Google, or an AI assistant.
        </Section>

        {/* FAQ — visible copy matches the FAQPage JSON-LD above. */}
        <section className={cn(sabCard, 'p-5 sm:p-6')}>
          <h2 className="text-lg font-semibold text-[#F1F3F1]">
            Methodology — frequently asked questions
          </h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-[14.5px] font-semibold text-[#F1F3F1]">{f.q}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-relaxed text-[#9BA8A0]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/steal-a-brainrot/values"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
          >
            Browse all Brainrot values
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/steal-a-brainrot/calculator"
            className="inline-flex items-center gap-2 rounded-lg border border-[#26332C] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#F1F3F1] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
          >
            Open the value calculator
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cn(sabCard, 'p-5 sm:p-6')}>
      <h2 className="text-lg font-semibold text-[#F1F3F1]">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-[#9BA8A0]">{children}</div>
    </section>
  )
}
