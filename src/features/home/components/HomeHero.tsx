'use client'

/**
 * HomeHero — section 1. Full-bleed, no container.
 *
 * Differentiated from PreFooterCtaBand (both are full-bleed art with centred
 * copy) on four axes, so the page doesn't open and close on the same move:
 *
 *   1. Structure — this art OVERHANGS the section and carries on behind
 *      section 2. The CTA band's art is self-contained. Hero reads as a
 *      scene you enter; the band reads as a band sitting in the page.
 *   2. Edges — no top fade: the art runs to the top of the page, under the
 *      transparent navbar. The CTA band fades on both edges.
 *   3. Exposure — brighter (.72 vs .55). Opening energy vs closing note.
 *   4. Content — the chip row is only here, which changes the silhouette.
 */

import Link from 'next/link'

/** Service categories — what you can buy. Game covers live in the footer matrix. */
const CATEGORY_CHIPS = [
  { label: 'Items', href: '/roblox/buy-items' },
  { label: 'Accounts', href: '/roblox/buy-accounts' },
  { label: 'Currency', href: '/roblox/buy-robux' },
  { label: 'Top Ups', href: '/topups' },
  { label: 'Boosting', href: '/boosting' },
] as const

export function HomeHero() {
  return (
    // Section sets no vertical padding, no horizontal padding and no
    // max-width: it opts into the page measure with `page-measure` and lets
    // the rhythm container own the spacing around it. The only offset it
    // owns is clearing the navbar, which is a transparent overlay here and
    // so takes up no layout space — derived from the token, not a constant.
    <section
      className="page-measure relative z-20 text-center"
      style={{ paddingTop: 'calc(var(--navbar-height, 60px) + 48px)' }}
    >
      {/* No art here: HomeHeroArt renders it as a -z-10 sibling of the
          rhythm container, so it can overhang past this section. */}

      {/* Copy measure — a reading width inside the section, not the
          section's own width. */}
      <div className="mx-auto w-full max-w-[680px]">
        <h1 className="text-[26px] font-semibold leading-[1.14] tracking-[-0.02em] text-text-primary lg:text-[32px] [text-wrap:balance]">
          Every Roblox trade, in one place
        </h1>

        <p className="mx-auto mt-3 max-w-[52ch] text-[14px] leading-[1.6] text-text-secondary">
          Items, accounts, Robux and top-ups. From real players.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/browse"
            // `bg-lime` is a stale NAME for the forest-green accent token
            // (--color-accent-default #2A7A50). Do not use `bg-accent`: that
            // resolves to the shadcn shim's 12% tint, not a button fill.
            // min-h-[44px] on coarse pointers is the iOS touch-target floor
            // and deliberately overrides the 36px button height there.
            className="inline-flex h-9 min-h-[44px] items-center justify-center rounded-md bg-lime px-5 text-[14px] font-medium text-text-inverse transition-colors duration-fast hover:bg-lime-hover active:bg-lime-pressed lg:min-h-0"
          >
            Browse Marketplace
          </Link>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {CATEGORY_CHIPS.map((chip) => (
            <li key={chip.label}>
              <Link
                href={chip.href}
                className="inline-flex h-7 items-center rounded-full border border-white/[0.14] bg-white/[0.06] px-3 text-[12px] font-medium text-text-primary backdrop-blur-sm transition-colors hover:border-white/[0.24] hover:bg-white/[0.11]"
              >
                {chip.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
