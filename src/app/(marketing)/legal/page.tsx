/**
 * /legal: every DropMarket policy on one page (2026-10-23). Research: Etsy
 * groups its legal hub by audience, eBay gives each policy a one-line
 * summary, G2G keeps a tile index at /legal. Groups and URLs come from
 * components/legal/legal-nav, so the hub, the page sidebars and the footer
 * can't disagree. Static: no DB read, no cookie client.
 */
import type { Metadata } from 'next'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import Link from '@/components/navigation/AppLink'
import { InfoHero } from '@/components/info'
import { groupedLegalDocs, legalDocHref, legalPageParts } from '@/components/legal/legal-nav'
import { COMPANY, COMPANY_REGISTERED_OFFICE } from '@/lib/config/company'
import { LEGAL_ENTITY } from '@/lib/legal/documents'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = seoMeta({
  title: 'Legal Terms and Policies',
  description:
    'Every DropMarket policy in one place: Terms of Use, refunds and SafeDrop Protection, privacy, fees, the Seller Agency Agreement and the marketplace rules.',
  alternates: { canonical: '/legal' },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'DropMarket Legal Terms and Policies',
    description: 'Terms, refunds, privacy, fees, seller terms and marketplace rules in one place.',
    url: '/legal',
    type: 'website',
  },
})

export default function LegalHubPage() {
  const groups = groupedLegalDocs()
  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Legal', path: '/legal' }])} />

      <InfoHero
        icon={ScalesIcon}
        tone="neutral"
        title="Legal Terms and Policies"
        lead="Everything that governs buying and selling on DropMarket. The main pages open with a short summary of the key points."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-12 space-y-12 sm:mt-14">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`group-${g.title}`}>
              <h2 id={`group-${g.title}`} className="text-subheading font-bold text-text-primary">
                {g.title}
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.docs.map((d) => {
                  const parts = legalPageParts(d.slug)
                  return (
                    <li key={d.slug}>
                      <Link
                        href={legalDocHref(d.slug)}
                        className={cn('group flex h-full flex-col rounded-lg p-5', MARKET_CARD, MARKET_CARD_HOVER)}
                      >
                        <span className="flex items-center justify-between gap-3 text-body font-semibold text-text-primary">
                          {d.title}
                          <ArrowRightIcon
                            size={15}
                            weight="bold"
                            aria-hidden
                            className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                        </span>
                        <span className="mt-2 line-clamp-3 text-body-sm leading-relaxed text-text-secondary">{d.description}</span>
                        {parts.length > 0 && (
                          <span className="mt-3 text-caption text-text-tertiary">Includes {parts.map((p) => p.title).join(', ')}</span>
                        )}
                        <span className="mt-auto pt-4 text-caption text-text-tertiary">
                          Updated {d.lastUpdated ?? LEGAL_ENTITY.lastUpdated}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-14 max-w-[72ch] text-body-sm leading-relaxed text-text-tertiary">
          These policies are issued by {COMPANY.legalName}, a company registered in {COMPANY.jurisdiction} (No. {COMPANY.companyNumber}),
          registered office {COMPANY_REGISTERED_OFFICE}. Questions:{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-text-secondary underline decoration-white/25 underline-offset-4 hover:text-text-primary">
            {COMPANY.email}
          </a>
          .
        </p>
      </div>
    </main>
  )
}
