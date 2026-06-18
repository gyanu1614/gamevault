'use client'

/**
 * V17v — SmartLink. A drop-in replacement for next/link that fixes the
 * "scroll jumps to top BEFORE the new page paints" glitch.
 *
 * Why this exists
 * ───────────────
 * Next.js App Router's <Link> default behavior:
 *   1. user clicks → router starts navigation
 *   2. router.push fires scrollTo(0,0) on the current page IMMEDIATELY
 *   3. new route fetches/paints
 *
 * Step 2 is visible to the user as "page jumps to top, then I see the
 * new page." Setting scroll={false} on Link disables step 2 — but
 * then the new page lands at whatever scroll position the user was
 * at, which is also wrong.
 *
 * SmartLink fixes both halves:
 *   • scroll={false} so the current page doesn't visibly jump
 *   • requestAnimationFrame after click: window.scrollTo(0,0) just
 *     before the new page paints, so users land on the new page at
 *     the top with no visible "rubber band" on the source.
 *
 * Use anywhere the source page is mid-scroll and the destination
 * should land at the top:
 *   • Card grids → detail pages
 *   • Seller chips on listing cards
 *   • Popular Games shelf
 *   • Search autocomplete picks
 *
 * Don't use for in-page anchors or destinations that want to preserve
 * scroll (e.g. back-button-style flows). Use plain next/link for those.
 */

import NextLink, { type LinkProps } from 'next/link'
import { forwardRef, type AnchorHTMLAttributes } from 'react'

type SmartLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: React.ReactNode
  }

/**
 * V17w — Final SmartLink. Just `next/link` with `scroll={false}`.
 *
 * Why this is the right answer
 * ───────────────────────────
 * Earlier iterations tried to do `window.scrollTo(0, 0)` on the
 * SOURCE page before/after the route push. That scroll is VISIBLE —
 * frame-by-frame screenshots confirmed the user sees their current
 * page jump back to the top BEFORE the destination renders. That IS
 * the bug we were trying to fix.
 *
 * Correct architecture:
 *   • Source page should NEVER scroll. `scroll={false}` on `next/link`
 *     suppresses Next's default scroll-to-top behavior on the source.
 *   • Destination page handles its own scroll reset in a
 *     `useLayoutEffect` — runs BEFORE first paint, so the user lands
 *     at the top of the new page without seeing any jump.
 *
 * Marketplace category page already does this. Shop page does this
 * (V17k). Add the same one-liner to any other destination that needs
 * it; don't compensate on the source.
 */
export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  function SmartLink({ children, ...rest }, ref) {
    return (
      <NextLink ref={ref} scroll={false} {...rest}>
        {children}
      </NextLink>
    )
  },
)
