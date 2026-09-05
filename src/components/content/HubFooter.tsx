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

const SUPPORT_EMAIL = 'support@dropmarket.gg'
const DISCORD_URL = 'https://discord.gg/z5ghW37JRu'

/* Brand social icons (monochrome SVG paths — same set as the marketplace footer). */
const SOCIALS: Array<{ name: string; href: string; path: string }> = [
  {
    name: 'Discord',
    href: DISCORD_URL,
    path: 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/dropmarket',
    path: 'M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84',
  },
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
    // Per-game seller landing (bare /sell 404s). Keyword-anchored for SEO.
    { name: `Sell ${gameName}`, href: `/${gameSlug}/sell` },
  ]

  return (
    // Seamless into the page: no hard divider — the footer sits on its own
    // gradient that fades up from the page (transparent → near-black) with a
    // faint forest bloom, and a giant ghosted wordmark behind it for depth.
    // mt-16 carries the page's bottom breathing room.
    <footer className="relative z-10 mt-16 overflow-hidden">
      {/* Ground: gradient fade from the page into the footer + a soft forest
          glow bleeding up from the top-centre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(1100px 320px at 50% 0%, rgba(79,180,119,0.06) 0%, transparent 70%), linear-gradient(180deg, transparent 0%, #0B0F0D 26%, #090C0B 100%)',
        }}
      />
      {/* Giant ghosted wordmark — brand presence, sits behind the content. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-0.18em] z-0 select-none text-center text-[22vw] font-extrabold leading-none tracking-[-0.04em] text-white/[0.02] lg:text-[15rem]"
      >
        DropMarket
      </span>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        {/* Row 1 — brand + the two link sets, side by side rather than stacked */}
        <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/brand/logo-mark-white.png"
                alt="DropMarket"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-[17px] font-bold text-[#F1F3F1]">DropMarket</span>
            </Link>
            <p className="mt-3 text-[13.5px] leading-6 text-[#8B978F]">
              Real {gameName} prices from completed sales, and a safer place to buy
              them — the seller is paid on delivery.
            </p>

            {/* Socials + direct support — the professional bit. */}
            <div className="mt-5 flex items-center gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#1E2723] bg-white/[0.03] text-[#9BA8A0] transition hover:border-[#2C3A31] hover:bg-white/[0.06] hover:text-[#8FBF9C]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex h-9 items-center gap-2 rounded-md border border-[#1E2723] bg-white/[0.03] px-3 text-[13px] font-semibold text-[#9BA8A0] transition hover:border-[#2C3A31] hover:bg-white/[0.06] hover:text-[#8FBF9C]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Contact Support
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-12 gap-y-8">
            <FooterGroup title={gameName} links={hubLinks} />
            <FooterGroup title="Marketplace" links={shopLinks} />
            <FooterGroup
              title="Support"
              links={[
                { name: 'Help Center', href: '/support' },
                { name: 'Trust & Safety', href: '/trust-safety' },
                { name: 'Refunds & Disputes', href: '/refunds' },
                { name: 'Email Support', href: `mailto:${SUPPORT_EMAIL}` },
              ]}
            />
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
      <h2 className="text-[13px] font-bold text-[#F1F3F1]">{title}</h2>
      <ul className="mt-3.5 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[13.5px] text-[#9BA8A0] transition-colors hover:text-[#8FBF9C]"
            >
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
