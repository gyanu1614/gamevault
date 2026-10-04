/**
 * Title helpers around the root layout's `template: '%s | DropMarket'`.
 *
 * A page title must be bare — the template brands it. A title that already
 * ends with the brand (an admin-entered `seo_title`, a legacy hard-coded
 * string) becomes `{ absolute }` so it isn't branded twice
 * ("… | DropMarket | DropMarket"). Social titles (OpenGraph) don't go through
 * the template, so they are branded explicitly, once.
 */
const BRAND = 'DropMarket'
const ENDS_WITH_BRAND = /\s*[|—–-]\s*dropmarket\s*$/i

export function pageTitle(title: string): string | { absolute: string } {
  const t = title.trim()
  return ENDS_WITH_BRAND.test(t) ? { absolute: t } : t
}

export function socialTitle(title: string): string {
  const t = title.trim()
  return ENDS_WITH_BRAND.test(t) ? t : `${t} | ${BRAND}`
}
