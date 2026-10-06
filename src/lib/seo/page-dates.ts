import { LEGAL_ENTITY } from '@/lib/legal/documents'

/**
 * Real change dates for sitemap entries that have no row to read one from.
 *
 * Google only trusts `lastmod` that is consistently accurate, and an
 * always-changing `new Date()` trains it to ignore the field (see sitemap.ts).
 * These are the dates of the last content change to each page's copy, taken from
 * the page file's history on main (2026-10-02). When the copy of one of these
 * pages changes, bump its date in the same commit. Pages whose content is a
 * database row (listings, value items, hubs, blog posts, categories) never come
 * from here: their date is the row's own updated_at.
 */
export const SITE_PAGES_UPDATED = {
  /** src/app/(marketing)/safedrop/page.tsx */
  safedrop: '2026-09-28',
  /** src/app/(marketing)/sell/fees/page.tsx */
  sellFees: '2026-09-29',
  /** src/app/early-seller/ — the public "Become a Seller" page */
  earlySeller: '2026-09-22',
  /** src/app/(marketplace)/[gameSlug]/values/methodology/page.tsx */
  methodology: '2026-09-20',
  /** src/lib/seo/landingPages.ts: the curated copy of every /buy/* page */
  landingPages: '2026-09-28',
} as const

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** '12 July 2026' -> '2026-07-12'. Throws on anything else: never invents a date. */
export function parseLongDate(text: string): string {
  const m = text.trim().match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/)
  const month = m ? MONTHS.indexOf(m[2]) : -1
  if (!m || month < 0) throw new Error(`Unrecognised date "${text}" (expected "12 July 2026")`)
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** The legal pack's own "last updated" date, shared by every legal page. */
export function legalLastUpdatedIso(): string {
  return parseLongDate(LEGAL_ENTITY.lastUpdated)
}
