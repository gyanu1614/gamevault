/**
 * Compact footer for the game content hub.
 *
 * The marketplace footer is a tall storefront directory — brand lockup, nav
 * row, socials, a game grid with "show more", then three columns of legal
 * links. On a guide or value page that's more footer than page, and it's in
 * the wrong palette (lime on near-black rather than the hub's forest).
 *
 * This is the hub's own: three tight rows on one hairline surface — tools,
 * marketplace, then a legal strip. Roughly a third of the height, same links
 * that matter, forest palette, square edges like the rest of the hub.
 *
 * Legal links are NOT trimmed: terms, privacy and the policy set have to stay
 * reachable from every page. They're demoted to a single wrapped strip instead
 * of three full columns, which is where most of the height went.
 */

import Link from 'next/link'
import Image from 'next/image'

const LEGAL = [
  { name: 'Terms', href: '/terms' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Cookies', href: '/cookies' },
  { name: 'SafeDrop Protection', href: '/safedrop-policy' },
  { name: 'Refunds & Disputes', href: '/refunds' },
  { name: 'Prohibited Items', href: '/prohibited' },
  { name: 'Trust & Safety', href: '/trust-safety' },
  { name: 'Company', href: '/company' },
]

export interface HubFooterLink {
  name: string
  href: string
}

export function HubFooter({
  gameName,
  gameSlug,
  tools,
  itemsHref,
  accountsHref,
}: {
  gameName: string
  gameSlug: string
  tools: Array<'values' | 'calculator'>
  itemsHref: string | null
  accountsHref: string | null
}) {
  // Data-driven, exactly like the nav: a game without a calculator or a
  // storefront category simply doesn't get that link.
  const hubLinks: HubFooterLink[] = [
    { name: 'Guides', href: `/${gameSlug}/blog` },
    ...tools.map((tool) => ({
      name: tool === 'values' ? 'Value List' : 'WFL Calculator',
      href: `/${gameSlug}/${tool}`,
    })),
    { name: 'Pricing Methodology', href: `/${gameSlug}/values/methodology` },
  ]

  const shopLinks: HubFooterLink[] = [
    ...(itemsHref ? [{ name: `Buy ${gameName} Items`, href: itemsHref }] : []),
    ...(accountsHref ? [{ name: `${gameName} Accounts`, href: accountsHref }] : []),
    { name: 'Browse All Listings', href: '/browse' },
    { name: 'Sell With Us', href: '/sell' },
  ]

  return (
    // mt-24 carries the page's bottom breathing room. It used to be `pb-24`
    // on each page's <main>, but the footer renders inside that main, so the
    // padding landed BELOW the footer as 96px of dead space at the end of
    // every hub page.
    <footer className="mt-24 border-t border-[#1E2723] bg-[#0A0D0B]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {/* Row 1 — brand + the two link sets, side by side rather than stacked */}
        <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/brand/logo-mark-white.png"
                alt="DropMarket"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-[16px] font-bold text-[#F1F3F1]">DropMarket</span>
            </Link>
            <p className="mt-2.5 text-[13.5px] leading-6 text-[#8B978F]">
              Real {gameName} prices from completed sales, and a safer place to buy
              them — the seller is paid only after you confirm.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-12 gap-y-7">
            <FooterGroup title={gameName} links={hubLinks} />
            <FooterGroup title="Marketplace" links={shopLinks} />
          </div>
        </div>

        {/* Row 2 — legal, one wrapped strip instead of three columns */}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#161d19] pt-6">
          {LEGAL.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-[#6D7A72] transition-colors hover:text-[#B9DCC4]"
            >
              {l.name}
            </Link>
          ))}
        </div>

        {/* Row 3 — the small print */}
        <div className="mt-5 flex flex-col gap-1.5 text-[12px] text-[#5E685E] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} DropMarket. All rights reserved.</span>
          <span>
            Not affiliated with, endorsed by, or sponsored by Roblox Corporation or any
            game developer.
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterGroup({ title, links }: { title: string; links: HubFooterLink[] }) {
  return (
    <div>
      <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#5E685E]">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[13.5px] text-[#C6CEC9] transition-colors hover:text-[#8FBF9C]"
            >
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
