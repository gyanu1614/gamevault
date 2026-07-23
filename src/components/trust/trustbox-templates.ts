/**
 * Trustpilot TrustBox constants — a plain (non-'use client') module.
 *
 * These are imported by BOTH server pages (safedrop, footer) and the client
 * TrustBox component. Keeping them out of the 'use client' file avoids the
 * RSC "Could not find the module … in the React Client Manifest" prerender
 * error that happens when a server component imports a value from a client
 * module during static export.
 */

/** Common Trustpilot TrustBox template IDs. */
export const TRUSTBOX_TEMPLATES = {
  /** Stars + rating + review count on one line (default). */
  mini: '5419b6a8b0d04a076446a9ad',
  /** Compact single-line: logo + stars + count. */
  microCombo: '5419b6ffb0d04a076446a9af',
  /** "Rated x/5" text + stars, smallest footprint. */
  microStar: '5419b732fbfb950b10de65e5',
  /** Horizontally scrolling recent reviews. */
  carousel: '54ad5defc6454f065c28af8b',
  /** Grid of recent reviews for dedicated trust sections. */
  grid: '539adbd6dec7e10e686debee',
  /** "Review us" collection CTA — the ONLY widget on the free plan
   *  (all display widgets above need Plus). Requires the matching
   *  `token` prop from the Get-code snippet. */
  reviewCollector: '56278e9abfbbba0bdcd568bc',
} as const

/** data-token for the free Review Collector widget (from its Get-code snippet). */
export const REVIEW_COLLECTOR_TOKEN = '96218c86-55f4-4221-b33a-6cfd8f0d1c8b'
