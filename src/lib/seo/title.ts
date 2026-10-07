import type { Metadata } from 'next'

/**
 * Page titles and the brand.
 *
 * The root layout appends the brand to every page title (`TITLE_TEMPLATE`), so
 * a page hands it a BARE title ('Support'), or `{ absolute }` when the brand
 * already leads ('DropMarket | Buy & Sell ...'). A page that also wrote the
 * brand itself rendered `... | DropMarket | DropMarket`.
 *
 * Two ways to keep a branded string from doubling, both ending in ONE brand:
 *  - `stripBrand(title)`: drop the trailing brand and let the template add it
 *    back. For the case where one branded string is reused on purpose for the
 *    social (OG) title, whose bare form feeds the templated `<title>`.
 *  - `pageTitle(title)` / `socialTitle(title)`: a title that already ends with
 *    the brand (an admin-entered `seo_title`, a legacy string) becomes
 *    `{ absolute }`, which the template skips; a social title, which never goes
 *    through the template, is branded explicitly, once. For titles whose text
 *    comes from data.
 * Neither is a licence to paper over a page that forgot the layout adds the brand.
 */
export const BRAND = 'DropMarket'

/** Root layout: every public page. */
export const TITLE_TEMPLATE = `%s | ${BRAND}`
/** Admin layout: the admin area has its own suffix. */
export const ADMIN_TITLE_TEMPLATE = `%s | ${BRAND} Admin`

// "| DropMarket", or " — DropMarket" / " - DropMarket" (a hyphen only counts with spaces around it).
const SEPARATOR = String.raw`(?:\s*\|\s*|\s+[—–-]\s+)`
const TRAILING_BRAND = new RegExp(`${SEPARATOR}${BRAND}\\s*$`, 'i')
const BRAND_AFTER_SEPARATOR = new RegExp(`${SEPARATOR}${BRAND}\\b`, 'gi')
const LEADING_BRAND_MARK = new RegExp(`^\\s*${BRAND}${SEPARATOR}`, 'i')

/** Remove a trailing brand mark (repeatedly); never returns an empty title. */
export function stripBrand(title: string): string {
  let out = title.trim()
  while (TRAILING_BRAND.test(out)) {
    const next = out.replace(TRAILING_BRAND, '').trim()
    if (!next) return BRAND
    out = next
  }
  return out
}

/** The text of the browser tab: the page title run through the layout template. */
export function resolveTitle(title: Metadata['title'], template: string): string | null {
  if (title === undefined || title === null) return null
  if (typeof title === 'string') return template.replace('%s', title)
  if ('absolute' in title && title.absolute) return title.absolute
  if ('default' in title && title.default) return title.default
  return null
}

/**
 * How many times the title uses the brand AS A MARK: a leading "DropMarket |"
 * or any "| DropMarket". The brand inside the copy ("How DropMarket Values ...")
 * is not a mark.
 */
export function brandMarkCount(title: string): number {
  const trailing = title.match(BRAND_AFTER_SEPARATOR)?.length ?? 0
  return trailing + (LEADING_BRAND_MARK.test(title) ? 1 : 0)
}

// ── pageTitle / socialTitle (value pages and category page) ──────────────────
const ENDS_WITH_BRAND = /\s*[|—–-]\s*dropmarket\s*$/i

/** A bare title for the layout template, or `{ absolute }` if it already ends with the brand. */
export function pageTitle(title: string): string | { absolute: string } {
  const t = title.trim()
  return ENDS_WITH_BRAND.test(t) ? { absolute: t } : t
}

/** A title for OpenGraph/Twitter (not templated): branded exactly once. */
export function socialTitle(title: string): string {
  const t = title.trim()
  return ENDS_WITH_BRAND.test(t) ? t : `${t} | ${BRAND}`
}

/**
 * The site's default share card (src/app/opengraph-image.tsx). Next replaces
 * the parent's whole `openGraph` object when a page sets its own, so a page
 * that sets `openGraph` without `images` ships NO og:image: the 2026-10-06
 * crawl found 346 such URLs. Pages without their own image spread this in.
 */
export const DEFAULT_OG_IMAGES = [{ url: '/opengraph-image', width: 1200, height: 630, alt: BRAND }]
