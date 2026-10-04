/**
 * Listing → value item matcher (pure; no server-only imports so it can run in
 * tests, scripts and the backfill alike).
 *
 * Listings carry no foreign key to a value item, and identity lives in
 * different places per game (see `_offerMatching.ts`):
 *   steal-a-brainrot  template `select-brainrot` = catalogue slug; the
 *                     mutation is usually only in the title ("Rainbow …").
 *   adopt-me          template `pet-name` = catalogue slug; the potion is the
 *                     `trait` option, whose SLUGS do not match their LABELS in
 *                     the live taxonomy (slug `r` = "Fly Ride (FR)", `fr` =
 *                     "Neon"), so variants resolve by label.
 *   other games       title only.
 *
 * Order: template identity → longest catalogue name in the title. Variant:
 * template field (by label) → longest variant name left in the title once the
 * item name is removed → the catalogue's default (SAB "default"; Adopt Me
 * leaves it unknown, since a bare "Bat Dragon" title doesn't say "no potion").
 */

export interface ValueCatalog {
  gameSlug: string
  items: ReadonlyArray<{ slug: string; name: string }>
  /** `key` is the URL segment; `names` are labels/aliases that identify it. */
  variants: ReadonlyArray<{ key: string; names: readonly string[] }>
  /** Template fields whose value is the catalogue item slug. */
  identityKeys?: readonly string[]
  /** Template fields whose value (or option label) names the variant. */
  variantKeys?: readonly string[]
  /** Variant assumed when a listing names none; omit to leave it unknown. */
  defaultVariant?: string
}

export interface ListingForMatch {
  title: string
  templateData: Record<string, unknown> | null | undefined
  /** attribute slug → option slug → option label (the category taxonomy). */
  optionLabels?: Record<string, Record<string, string>>
}

export interface ValueItemMatch {
  itemSlug: string
  variant: string | null
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function slugifyValue(value: string): string {
  return normalizeText(value).replace(/ /g, '-')
}

const pad = (s: string) => ` ${s} `

function templateString(data: ListingForMatch['templateData'], key: string): string | null {
  const v = data?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function variantFromLabel(catalog: ValueCatalog, label: string): string | null {
  const paren = label.match(/\(([^)]+)\)/)?.[1]
  const candidates = [label.replace(/\([^)]*\)/g, ''), paren, label].filter(
    (c): c is string => !!c && !!normalizeText(c),
  )
  for (const candidate of candidates) {
    const n = normalizeText(candidate)
    const slug = slugifyValue(candidate)
    const hit = catalog.variants.find(
      (v) => v.key === slug || v.names.some((name) => normalizeText(name) === n),
    )
    if (hit) return hit.key
  }
  return null
}

export function matchListingToValueItem(
  listing: ListingForMatch,
  catalog: ValueCatalog,
): ValueItemMatch | null {
  const title = pad(normalizeText(listing.title ?? ''))

  // 1. Identity.
  let item: ValueCatalog['items'][number] | undefined
  for (const key of catalog.identityKeys ?? []) {
    const raw = templateString(listing.templateData, key)
    if (!raw) continue
    const slug = slugifyValue(raw)
    item = catalog.items.find((i) => i.slug === slug)
    if (item) break
  }
  if (!item) {
    let best = 0
    for (const candidate of catalog.items) {
      const n = normalizeText(candidate.name)
      if (n && n.length > best && title.includes(pad(n))) {
        item = candidate
        best = n.length
      }
    }
  }
  if (!item) return null

  // 2. Variant: template field first (by option label).
  for (const key of catalog.variantKeys ?? []) {
    const raw = templateString(listing.templateData, key)
    if (!raw) continue
    const label = listing.optionLabels?.[key]?.[raw] ?? raw
    const variant = variantFromLabel(catalog, label)
    if (variant) return { itemSlug: item.slug, variant }
  }

  // 3. Variant from what is left of the title once the item name is removed,
  // so a mutation word inside an item's own name ("Lava Boss") isn't read.
  const itemName = normalizeText(item.name)
  const rest = itemName ? title.replace(pad(itemName), '  ') : title
  const names = catalog.variants
    .flatMap((v) => v.names.map((name) => ({ key: v.key, n: normalizeText(name) })))
    // One-letter codes ("N", "R") are too ambiguous in free text.
    .filter((x) => x.n.length > 1)
    .sort((a, b) => b.n.length - a.n.length)
  const hit = names.find((x) => rest.includes(pad(x.n)))
  if (hit) return { itemSlug: item.slug, variant: hit.key }

  return { itemSlug: item.slug, variant: catalog.defaultVariant ?? null }
}
