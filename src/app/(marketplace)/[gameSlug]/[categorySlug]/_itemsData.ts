/**
 * V15 — Server-side data helpers for the Items page.
 *
 * Responsibilities:
 *   1. Resolve the per-(game, items) attribute template from the admin
 *      `attribute_templates` table so the filter dropdowns reflect the
 *      taxonomy sellers actually used.
 *   2. Build a normalised `ItemOffer` from a raw `listings` row + its
 *      seller profile.
 *   3. Provide a deterministic hue per category slug so the badge color
 *      stays consistent across the catalogue (and remains decided
 *      by the admin's attribute slug — not random).
 */

import 'server-only'
import type { ItemOffer, ItemsTaxonomy, TaxonomyOption } from './_itemsTypes'
import { buildItemSlug } from '@/lib/utils/item-seo-slug'
import { getAttributeTemplateByGameAndCategory } from '@/lib/actions/new-schema'

/* ──────────────────────────────────────────────────────────────────────────
   Hue table — keeps category badges visually consistent across requests.
   We map well-known category slugs to the same hues the handoff demoes,
   and fall back to a deterministic hash for anything else so a new
   category from the admin still gets a stable colour.
   ────────────────────────────────────────────────────────────────────────── */
const KNOWN_HUES: Record<string, number> = {
  pets: 152,
  eggs: 312,
  fruits: 28,
  knives: 255,
  limiteds: 48,
  // Steal-a-Brainrot specific tags get sensible defaults too:
  brainrots: 200,
  rare: 280,
  legendary: 40,
  mythical: 320,
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}
export function categoryHue(slug: string | null | undefined): number {
  if (!slug) return 200
  const k = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (KNOWN_HUES[k]) return KNOWN_HUES[k]
  return hashHue(k)
}

/* ──────────────────────────────────────────────────────────────────────────
   Taxonomy resolution
   ────────────────────────────────────────────────────────────────────────── */

/**
 * V15b — Build the full filter chain from the admin attribute template.
 *
 * Every select-style attribute becomes a filter dropdown. Conditional
 * children are surfaced by the client only after their parent has a
 * non-default value (mirrors the seller wizard behaviour).
 *
 * Returns attributes in topological order so the UI can render them
 * left-to-right and naturally reveal children as the user fills parents:
 *
 *   Brainrots ▼  →  Rarity ▼  →  Brainrot ▼  →  Price ▼
 *
 * For back-compat the legacy `categories` / `mutations` lists are also
 * populated from the first two select attributes — components that
 * haven't migrated to `filters` still get something to render.
 */
export async function loadItemsTaxonomy(
  gameId: string,
  globalCategorySlug = 'items',
): Promise<ItemsTaxonomy> {
  const res = await getAttributeTemplateByGameAndCategory(gameId, globalCategorySlug)
  const empty: ItemsTaxonomy = { filters: [], categories: [], mutations: [] }
  if (!res.success || !res.data) return empty

  const attrs = (res.data.attributes ?? []).filter(
    (a) => a.type === 'select' || a.type === 'multiselect' || a.type === 'image_select',
  )
  if (attrs.length === 0) return empty

  // Build a slug→Attribute map for resolving conditional rules from
  // trigger_attribute_id (uuid) → slug (stable client identifier).
  const bySlug = new Map<string, typeof attrs[number]>()
  const byId = new Map<string, typeof attrs[number]>()
  attrs.forEach((a) => {
    bySlug.set(a.slug, a)
    byId.set(a.id, a)
  })

  // Topological sort: parents before children. attrs are already in
  // sort_order from the SQL query, which the admin keeps in document
  // order, but we still run a Kahn-style sort defensively so a
  // misconfigured template can't lock us out.
  const sorted: typeof attrs = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (a: typeof attrs[number]) => {
    if (visited.has(a.id)) return
    if (visiting.has(a.id)) return // cycle — skip to avoid infinite recursion
    visiting.add(a.id)
    const rules = a.conditional_rules ?? []
    for (const r of rules) {
      const parent = byId.get(r.trigger_attribute_id)
      if (parent) visit(parent)
    }
    visiting.delete(a.id)
    visited.add(a.id)
    sorted.push(a)
  }
  attrs.forEach(visit)

  const toOption = (o: { slug: string; label: string }): TaxonomyOption => ({
    slug: o.slug,
    label: o.label,
    hue: categoryHue(o.slug),
  })

  const filters = sorted.map((a) => ({
    slug: a.slug,
    label: a.name || a.slug,
    options: (a.options ?? []).map(toOption),
    conditionalRules: (a.conditional_rules ?? [])
      .map((r) => {
        const parent = byId.get(r.trigger_attribute_id)
        if (!parent) return null
        return {
          triggerAttrSlug: parent.slug,
          operator: r.operator,
          triggerValues: r.trigger_values ?? [],
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  }))

  // Back-compat scalars.
  const topLevel = filters.filter((f) => f.conditionalRules.length === 0)
  return {
    filters,
    categories: (topLevel[0]?.options ?? []).map((o) => ({ ...o, hue: categoryHue(o.slug) })),
    mutations: (topLevel[1]?.options ?? []).map((o) => ({ slug: o.slug, label: o.label })),
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Listing → ItemOffer mapper
   ────────────────────────────────────────────────────────────────────────── */

/** Pluck a string-or-array-of-strings from template_data under any of the keys. */
function pickStringList(
  data: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string[] {
  if (!data) return []
  for (const k of keys) {
    const v = data[k]
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    }
    if (typeof v === 'string' && v.trim()) return [v]
  }
  return []
}

const IDENTITY_KEYS = ['brainrot', 'pet', 'pet_name', 'item', 'item_name', 'skin', 'fruit', 'knife', 'name'] as const
const MODIFIER_KEYS = ['mutation', 'modifier', 'modifiers', 'type', 'variant', 'rarity'] as const
const CATEGORY_KEYS = ['category', 'family', 'pet_category', 'item_category'] as const

export interface RawListing {
  id: string
  /** V15h — listings.slug — stored kebab slug used by the detail page. */
  slug?: string | null
  title: string
  price: number | null
  /** Pre-discount price; drives the strikethrough + % off on the card. */
  original_price?: number | null
  /** Seller-set delivery window label (e.g. "instant", "20min", "1hr"). */
  delivery_time?: string | null
  /** Remaining stock. */
  quantity?: number | null
  /** Unlimited-stock flag. */
  is_unlimited?: boolean | null
  images?: string[] | null
  /** V28 — Seller description; only selected where a surface needs it. */
  description?: string | null
  template_data?: Record<string, unknown> | null
  seller?: {
    id?: string | null
    username?: string | null
    shop_name?: string | null
    avatar_url?: string | null
    seller_tier?: string | null
    seller_rating?: number | null
    total_reviews?: number | null
    total_sales?: number | null
    is_verified?: boolean | null
  } | null
  category?: { slug?: string | null; name?: string | null } | null
}

/**
 * Look up a label from the taxonomy by slug; if the slug isn't in the
 * taxonomy, prettify it ("garama-mandundung" → "Garama Mandundung").
 */
function labelFromTaxonomy(
  taxonomy: ItemsTaxonomy,
  field: 'categories' | 'mutations',
  slug: string,
): string {
  const opt = taxonomy[field].find((o) => o.slug === slug)
  if (opt) return opt.label
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function slugify(v: string): string {
  return v
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function listingToOffer(
  listing: RawListing,
  taxonomy: ItemsTaxonomy,
): ItemOffer {
  const tpl = listing.template_data ?? null
  const identityList = pickStringList(tpl, IDENTITY_KEYS)
  const mutationsRaw = pickStringList(tpl, MODIFIER_KEYS)
  const categoryRaw = pickStringList(tpl, CATEGORY_KEYS)[0]

  // Display name: prefer the template's identity field; fall back to title.
  const name = identityList[0]?.trim() || listing.title || 'Item'

  // Category slug + label + hue.
  const catSlug = slugify(categoryRaw || listing.category?.slug || 'items')
  const categoryLabel = labelFromTaxonomy(taxonomy, 'categories', catSlug) || listing.category?.name || 'Items'

  // Mutation slugs + labels.
  const mutationSlugs = mutationsRaw.map(slugify).filter(Boolean)
  const mutationLabels = mutationSlugs.map((s) => labelFromTaxonomy(taxonomy, 'mutations', s))

  // Seller profile.
  const seller = listing.seller ?? null
  const sellerName: string =
    seller?.shop_name?.trim() || seller?.username || 'Seller'
  const verified =
    !!seller?.is_verified ||
    (!!seller?.seller_tier && seller.seller_tier !== 'unverified')
  const ratingRaw = seller?.seller_rating
  const rating = ratingRaw != null ? Math.min(100, Math.max(0, Number(ratingRaw))) : 95

  // Slug used for canonical URLs.
  const slug = buildItemSlug({
    templateData: tpl,
    title: listing.title,
    id: listing.id,
  })

  return {
    id: listing.id,
    slug,
    // V15h — Stored slug from listings.slug (fallback to id) so the
    // card can link directly to the canonical detail URL that the
    // /marketplace/[gameSlug]/[categorySlug]/[listingSlug] page expects.
    detailSlug: listing.slug?.trim() || listing.id,
    detailCategorySlug: listing.category?.slug ?? 'items',
    name,
    categoryLabel,
    categorySlug: catSlug,
    categoryHue: categoryHue(catSlug),
    mutations: mutationLabels,
    mutationSlugs,
    pricePerUnit: Number(listing.price ?? 0),
    // Only treat as a discount when the original is strictly higher.
    originalPrice:
      listing.original_price != null && Number(listing.original_price) > Number(listing.price ?? 0)
        ? Number(listing.original_price)
        : null,
    deliveryTime: listing.delivery_time?.trim() || null,
    stock: listing.is_unlimited ? null : (listing.quantity ?? null),
    isUnlimited: !!listing.is_unlimited,
    imageUrl: Array.isArray(listing.images) && listing.images.length > 0
      ? (listing.images[0] as string)
      : null,
    description: listing.description?.trim() || null,
    seller: {
      id: seller?.id ?? null,
      username: seller?.username ?? 'seller',
      shopName: seller?.shop_name ?? null,
      avatarUrl: seller?.avatar_url ?? null,
      verified,
      rating,
      sales: seller?.total_sales ?? 0,
      reviewCount: seller?.total_reviews ?? 0,
    },
    recommended: Math.round(rating),
    sellerId: seller?.id ?? null,
    // V24 — Pretty breadcrumb of selected option labels along the taxonomy
    // chain (e.g. ["Brainrot", "Secret"] or ["Blade Ball"]).
    //
    // Intent: show the CATEGORY context, without repeating the card title.
    // The old logic blindly dropped the LAST attribute (assuming it was the
    // listing's identity, like "Garama and Madundung"). That broke games
    // whose only attribute is a real category — e.g. Roblox items have a
    // single `game` attribute ("Blade Ball") that ISN'T the title, so the
    // breadcrumb came out empty. Now we walk EVERY attribute and only skip
    // the value that actually matches the displayed name (the true dedup).
    breadcrumb: (() => {
      const out: string[] = []
      const nameSlug = slugify(name)
      for (const f of taxonomy.filters) {
        const raw = tpl ? tpl[f.slug] : null
        const value = Array.isArray(raw) ? raw[0] : raw
        if (typeof value !== 'string' || !value) continue
        const sl = slugify(value)
        // Skip the attribute that produced the title (avoids duplication).
        if (sl === nameSlug) continue
        const opt = f.options.find((o) => o.slug === sl)
        if (opt) out.push(opt.label)
        else
          out.push(
            value
              .split(/[\s-]+/g)
              .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
              .join(' '),
          )
      }
      return out
    })(),
    attributeValues: (() => {
      const out: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(tpl ?? {})) {
        if (typeof v === 'string') {
          out[k] = slugify(v)
        } else if (Array.isArray(v)) {
          out[k] = v
            .filter((x): x is string => typeof x === 'string')
            .map(slugify)
        }
      }
      return out
    })(),
  }
}
