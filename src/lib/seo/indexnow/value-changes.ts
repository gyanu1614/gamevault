import { hasHubPage } from '@/lib/content/theme'

/**
 * When a value page's CASH value really moved: the one threshold shared by the
 * SEO evidence (lib/seo/gate — the page's visible "Updated", dateModified and
 * sitemap lastmod, judged against the value at the last move) and the listing
 * price edits (./listing-events). A value that appears or disappears counts; a
 * move smaller than EITHER threshold does not. The old job re-sent every Steal
 * a Brainrot URL (~504) every day whether or not a price changed.
 */
export const VALUE_CHANGE_MIN_RELATIVE = 0.05
export const VALUE_CHANGE_MIN_ABSOLUTE_USD = 0.25

export interface ValueSample {
  slug: string
  previous: number | null
  current: number | null
}

export function isMaterialValueChange(previous: number | null, current: number | null): boolean {
  if (previous == null && current == null) return false
  if (previous == null || current == null) return true
  const delta = Math.abs(current - previous)
  if (delta < VALUE_CHANGE_MIN_ABSOLUTE_USD) return false
  if (previous === 0) return true
  return delta / Math.abs(previous) >= VALUE_CHANGE_MIN_RELATIVE
}

/** Items (once each) with at least one material move across their samples. */
export function changedItemSlugs(samples: ValueSample[]): string[] {
  const changed = new Set<string>()
  for (const s of samples) if (isMaterialValueChange(s.previous, s.current)) changed.add(s.slug)
  return [...changed]
}

/** The changed items plus the game pages whose numbers they feed. Nothing changed: nothing. */
export function valuePageUrls(gameSlug: string, itemSlugs: string[]): string[] {
  if (itemSlugs.length === 0) return []
  return [
    ...itemSlugs.map((slug) => `/${gameSlug}/values/${slug}`),
    // The Steal a Brainrot game page IS its values landing, so it moves too.
    ...(gameSlug === 'steal-a-brainrot' ? [`/${gameSlug}`] : []),
    ...(hasHubPage(gameSlug, 'values') ? [`/${gameSlug}/values`] : []),
    ...(hasHubPage(gameSlug, 'calculator') ? [`/${gameSlug}/calculator`] : []),
    ...(hasHubPage(gameSlug, 'priceIndex') ? [`/${gameSlug}/price-index`] : []),
  ]
}
