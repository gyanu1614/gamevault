/**
 * V15 — Shared types for the Items page (Showcase card design).
 *
 * `ItemOffer` is the normalised listing shape the client renders.
 * `ItemsTaxonomy` is the per-game filter taxonomy derived from the
 * admin attribute_templates so dropdowns reflect what sellers actually
 * configured for this game.
 */

export interface ItemSeller {
  id: string | null
  username: string
  shopName?: string | null
  avatarUrl?: string | null
  verified: boolean
  rating: number
  sales: number
}

export interface ItemOffer {
  id: string
  /** SEO-friendly slug used in the canonical URL, e.g. "neon-garama-mandundung". */
  slug: string
  /** V15h — Stored listing slug from the listings table. Used to build
   *  the canonical detail URL `/marketplace/{game}/{category}/{slug}`.
   *  Falls back to the listing id when missing. */
  detailSlug: string
  /** V15h — Real category slug from the listings.category row (e.g.
   *  "items"). Combined with detailSlug to form the detail URL. */
  detailCategorySlug: string
  /** Listing title — fallback display name when template_data isn't set. */
  name: string
  /** Category label shown on the badge ("Pets", "Limiteds", …). */
  categoryLabel: string
  /** Slug of the category option (drives filter matching). */
  categorySlug: string
  /** OKLCH hue used to colour the category badge. */
  categoryHue: number
  /** Modifier chips ("Neon", "Mega", …) shown over the card. */
  mutations: string[]
  /** Slugified mutations — drives the Mutation filter. */
  mutationSlugs: string[]
  pricePerUnit: number
  imageUrl: string | null
  seller: ItemSeller
  /** Recommended score (0-100). Higher = better default sort position. */
  recommended: number
  /** Used by self-purchase detection on the client. */
  sellerId: string | null
  /** V15b — raw template_data keyed by attribute slug. Used by the client
   *  filter logic to test against the conditional-chain dropdowns. */
  attributeValues: Record<string, string | string[]>
  /** V15c — Pretty breadcrumb labels for the chain of selected attributes
   *  in the order the seller filled them (e.g. ["Brainrot", "Secret"]).
   *  Stops before the final identity attribute so the name shown in the
   *  card title isn't duplicated as a badge. */
  breadcrumb: string[]
}

export interface TaxonomyOption {
  slug: string
  label: string
  /** OKLCH hue (0-360) for the badge tint. Only relevant on Category. */
  hue?: number
}

/**
 * V15b — Conditional rule: this attribute only appears when the trigger
 * attribute's current value satisfies the operator. Mirrors the admin
 * `attribute_conditional_rules` row shape but trimmed to what the client
 * filter needs.
 */
export interface FilterConditionalRule {
  triggerAttrSlug: string
  operator: 'equals' | 'not_equals' | 'in' | 'not_in'
  triggerValues: string[]
}

/**
 * One filter dropdown on the items page. May be the top-level attribute
 * (always visible) or a conditional child (only visible once its parent
 * has a non-default value).
 */
export interface FilterAttribute {
  slug: string
  label: string
  options: TaxonomyOption[]
  conditionalRules: FilterConditionalRule[]
}

export interface ItemsTaxonomy {
  /**
   * Ordered list of all select-style attributes from the admin template.
   * Top-level attributes (no conditional_rules) come first; conditional
   * children come after their parents (topological order).
   */
  filters: FilterAttribute[]
  /** @deprecated kept for back-compat. Use `filters` instead. */
  categories: TaxonomyOption[]
  /** @deprecated kept for back-compat. Use `filters` instead. */
  mutations: TaxonomyOption[]
}

/** Default sort options surfaced in the results bar. */
export type ItemSort =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'top-rated'
  | 'best-sellers'

export interface PriceBand {
  slug: string
  label: string
  min: number
  max: number | null
}

export const PRICE_BANDS: PriceBand[] = [
  { slug: 'any', label: 'Any price', min: 0, max: null },
  { slug: 'under-10', label: 'Under $10', min: 0, max: 10 },
  { slug: '10-30', label: '$10 – $30', min: 10, max: 30 },
  { slug: '30-80', label: '$30 – $80', min: 30, max: 80 },
  { slug: '80-plus', label: '$80+', min: 80, max: null },
]
