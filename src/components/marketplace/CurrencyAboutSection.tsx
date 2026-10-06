/**
 * Seam for the long-form SEO article ("Buy <Game> <Currency> Cheap") that
 * closes the currency pages and the game hub, after the FAQ.
 *
 * Owner, 2026-10-05: the article is being researched and designed
 * separately, so this renders nothing for now. It is already placed in
 * the page order (product → How It Works → FAQ → this → footer) on the
 * flexible currency page, the bundle currency page and the game hub, so
 * the article lands here without touching the pages again. Keep it a
 * server-renderable component: the article's text must be in the HTML.
 */

export function CurrencyAboutSection(_props: { gameName: string; currencyName?: string | null }) {
  return null
}
