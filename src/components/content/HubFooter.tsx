/**
 * Compact footer for the game content hub.
 *
 * The marketplace footer is a tall storefront directory — brand lockup, nav
 * row, socials, a game grid with "show more", then three columns of legal
 * links. On a guide or value page that's more footer than page.
 *
 * This is the hub's own: three tight rows on one hairline surface — tools,
 * marketplace, then a legal strip. Roughly a third of the height, same links
 * that matter, on the marketplace's neutral near-black tokens.
 *
 * Legal links are NOT trimmed: terms, privacy and the policy set have to stay
 * reachable from every page. They're demoted to a single wrapped strip instead
 * of three full columns, which is where most of the height went.
 */

import { DISCORD_INVITE_URL } from '@/lib/config/founding-seller'
import Link from '@/components/navigation/AppLink'
import { HUB_TOOL_PATH, type HubTool } from '@/lib/content/hub-tools'
import { hasHubPage } from '@/lib/content/theme'
import Image from 'next/image'
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/ssr/DiscordLogo'
import { TwitterLogoIcon } from '@phosphor-icons/react/dist/ssr/TwitterLogo'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple'

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

/* Brand socials — Phosphor logo glyphs (no hand-drawn SVG paths). */
const SOCIALS: Array<{ name: string; href: string; Icon: typeof DiscordLogoIcon }> = [
  { name: 'Discord', href: DISCORD_INVITE_URL, Icon: DiscordLogoIcon },
  { name: 'Twitter', href: 'https://twitter.com/dropmarket', Icon: TwitterLogoIcon },
]

/* Fill-only icon chip (VALUE_BTN_SECONDARY's fill, no outline). */
const CHIP =
  'flex h-9 items-center justify-center rounded-md bg-white/[0.05] text-text-secondary transition-colors ' +
  'hover:bg-white/[0.09] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

export interface HubFooterLink {
  name: string
  href: string
}

/** Footer link text per tool: keyword anchors ("Free Murder Mystery 2 Items"). */
const FOOTER_TOOL_NAME: Record<HubTool, (gameName: string) => string> = {
  values: () => 'Value List',
  calculator: () => 'WFL Calculator',
  chromas: (g) => `${g} Chroma Values`,
  events: (g) => `${g} Events`,
  freeItems: (g) => `Free ${g} Items`,
  codes: (g) => `${g} Codes`,
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
  tools: HubTool[]
  itemsHref: string | null
  accountsHref: string | null
}) {
  // Data-driven, exactly like the nav: a game without a calculator or a
  // storefront category simply doesn't get that link.
  const hubLinks: HubFooterLink[] = [
    // Guides only where the game publishes a blog (MM2 has none: the link was a 404).
    ...(hasHubPage(gameSlug, 'blog') ? [{ name: 'Guides', href: `/${gameSlug}/blog` }] : []),
    ...tools.map((tool) => ({
      name: FOOTER_TOOL_NAME[tool](gameName),
      href: `/${gameSlug}/${HUB_TOOL_PATH[tool]}`,
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
    // faint neutral bloom, and a giant ghosted wordmark behind it for depth.
    // mt-16 carries the page's bottom breathing room.
    <footer className="relative z-10 mt-16 overflow-hidden">
      {/* Ground: gradient fade from the page into the footer + a soft neutral
          glow bleeding up from the top-centre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(1100px 320px at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%), linear-gradient(180deg, transparent 0%, var(--color-bg-base) 26%, #111216 100%)',
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
                src="/brand/logo-mark-white.avif"
                alt="DropMarket"
                width={28}
                height={28}
                className="h-7 w-7"
                // Already an optimised 2 KB AVIF rendered at ~30px — re-encoding
                // it to WebP bills a transformation and saves nothing.
                unoptimized
              />
              <span className="text-[17px] font-bold text-text-primary">DropMarket</span>
            </Link>
            <p className="mt-3 text-[13.5px] leading-6 text-text-secondary">
              Real {gameName} prices from live marketplace listings, and a safer
              place to buy them — get exactly what you ordered, or your money
              back.
            </p>

            {/* Socials + direct support — the professional bit. */}
            <div className="mt-5 flex items-center gap-2.5">
              {SOCIALS.map(({ name, href, Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className={`${CHIP} w-9`}
                >
                  <Icon size={18} weight="fill" aria-hidden />
                </a>
              ))}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={`${CHIP} gap-2 px-3 text-[13px] font-semibold`}
              >
                <EnvelopeSimpleIcon size={16} weight="bold" aria-hidden />
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
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-6">
          {LEGAL.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-text-tertiary transition-colors hover:text-text-primary"
            >
              {l.name}
            </Link>
          ))}
        </div>

        {/* Row 3 — the small print */}
        <div className="mt-5 flex flex-col gap-1.5 text-[12px] text-text-disabled sm:flex-row sm:items-center sm:justify-between">
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
      <h2 className="text-[13px] font-bold text-text-primary">{title}</h2>
      <ul className="mt-3.5 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[13.5px] text-text-secondary transition-colors hover:text-text-primary"
            >
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
