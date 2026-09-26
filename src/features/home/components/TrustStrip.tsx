/**
 * TrustStrip — four proof points plus the ways to reach us, as its own row
 * beneath the pre-footer CTA band.
 *
 * ONLY the four proof points live here. Live Chat, Discord, email and phone
 * stay in the footer — they are contact details, not reassurance.
 *
 * Kept as a separate component (not folded INTO PreFooterCtaBand) so it sits
 * on the page surface rather than on the band's art: the band carries its own
 * background image and grade stack, and text over that was unreadable.
 *
 * Uses SilverIcon — the site's silver-glass 3D icon material — not line
 * icons, matching the treatment this strip had in the footer.
 */

import Link from 'next/link'

import { SilverIcon } from '@/components/ui/silver-icon'

const EMAIL = 'support@dropmarket.gg'

const TRUST_ITEMS: Array<{ icon: string; title: string; sub: string; href?: string }> = [
  {
    icon: '/icons/set/shield-check.svg',
    title: 'SafeDrop Protection',
    sub: 'Every order covered',
    href: '/safedrop',
  },
  { icon: '/icons/set/wallet.svg', title: 'Secure Payments', sub: 'Visa, Apple Pay, crypto' },
  {
    icon: '/icons/set/verified.svg',
    title: 'UK Registered Company',
    sub: 'DropMarket Ltd',
    href: '/company',
  },
  {
    icon: '/icons/set/support.svg',
    title: 'Real Human Support',
    sub: EMAIL,
    href: `mailto:${EMAIL}`,
  },
]

export function TrustStrip() {
  return (
    <section className="page-measure">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-x-8">
        {TRUST_ITEMS.map((item) => {
          const body = (
            <span className="flex items-center gap-3">
              <SilverIcon src={item.icon} className="h-8 w-8 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-white">
                  {item.title}
                </span>
                <span className="block truncate text-[13px] text-text-tertiary">{item.sub}</span>
              </span>
            </span>
          )
          return item.href ? (
            <Link
              key={item.title}
              href={item.href}
              className="transition-opacity duration-200 hover:opacity-80"
            >
              {body}
            </Link>
          ) : (
            <span key={item.title}>{body}</span>
          )
        })}
      </div>

    </section>
  )
}
