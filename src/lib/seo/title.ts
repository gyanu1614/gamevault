import type { Metadata } from 'next'

/**
 * Page titles and the brand.
 *
 * The root layout appends the brand to every page title (`TITLE_TEMPLATE`), so
 * a page hands it a BARE title ('Support'), or `{ absolute }` when the brand
 * already leads ('DropMarket | Buy & Sell ...'). A page that also wrote the
 * brand itself rendered `... | DropMarket | DropMarket`.
 *
 * `stripBrand` is for the one legitimate case where a branded string is reused
 * on purpose (for example an OG/social title that keeps the brand, whose same
 * text must be bare for the templated `<title>`). Do not use it to paper over a
 * page that simply forgot the layout adds the brand.
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
