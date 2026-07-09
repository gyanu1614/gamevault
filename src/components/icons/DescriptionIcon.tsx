/**
 * DescriptionIcon — themed glyph for the listing "Description" section.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  ▸ TO SWAP THIS ICON LATER:
 *    Replace the <svg>…</svg> markup below with your own. Keep these two
 *    contracts so the call site keeps working with no other changes:
 *      1. Accept `className` and spread `...props` onto the root <svg>.
 *      2. Use `stroke="currentColor"` / `fill="currentColor"` (NOT a
 *         hard-coded hex) so the icon inherits the theme color from its
 *         parent — the call site tints it lime via `text-lime-text`.
 *    Recommended: a 24×24 viewBox, 1.75 stroke width, round caps/joins to
 *    match the rest of the lucide-style icons used across the app.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { SVGProps } from 'react'

export default function DescriptionIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Document sheet */}
      <path d="M5.5 3.5h9L18.5 7.5v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      {/* Folded corner */}
      <path d="M14 3.5v3a1.5 1.5 0 0 0 1.5 1.5h3" />
      {/* Text lines */}
      <path d="M7.5 12h7" />
      <path d="M7.5 15.5h7" />
      <path d="M7.5 8.5h2.5" />
    </svg>
  )
}
