/**
 * Adopt Me — bulk import config.
 *
 * Catalogue: `adopt_me_pets` (slug, name, rarity, origin, image_url).
 * Variants: the eight codes in `@/lib/adopt-me/variants`, which is also what
 *           `adopt_me_pet_values.variant` stores.
 * Prices:   `adopt_me_pet_values` (pet_id, variant) → cheapest_usd.
 *
 * Two things to know about this game's data:
 *   · there is no alias table — `CatalogueItem.aliases` is empty and the
 *     importer leans on its own `listing_import_aliases` for supplier
 *     spellings. Teaching it one spelling is a row, not a code change.
 *   · a lot of the values are DERIVED, not observed (`is_estimated`), because
 *     the catalogue was seeded before there were sales. They are surfaced as
 *     `estimated: true` so an auto-priced batch refuses them by default.
 */
import { VARIANTS, VARIANT_LABEL, VARIANT_NOTE } from '@/lib/adopt-me/variants'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { buildTitle, buildDescription, variantTitleToken } from '../copy'
import { priceKey, type GameImportConfig, type ImportReader, type ImportCatalogue, type MarketPrice } from '../types'

const GAME_NAME = 'Adopt Me'
const DELIVERY = { method: 'manual' as const, window: '1hr' }

export const adoptMeImportConfig: GameImportConfig = {
  gameSlug: 'adopt-me',
  categorySlug: 'items',
  itemNoun: 'pet',
  variantNoun: 'variant',
  delivery: DELIVERY,
  wikiHost: 'adoptme.fandom.com',
  placeholderImage: '/icons/categories/items.svg',
  // Everything this config imports is a pet. The Trait attribute is filled
  // from the row's variant automatically; this covers the Item Type filter.
  attributeHints: { 'item type': 'Pets' },

  async loadCatalogue(client: ImportReader): Promise<ImportCatalogue> {
    // Paged: one PostgREST response stops at 1,000 rows, silently.
    const { data, error } = await fetchAllRows((from, to) =>
      client
        .from('adopt_me_pets')
        .select('slug, name, rarity, origin_type, origin_detail, image_url')
        .eq('is_active', true)
        .order('id')
        .range(from, to),
    )
    if (error) throw new Error(`adopt-me catalogue: ${(error as { message?: string }).message ?? error}`)

    const rows = (data ?? []) as Array<{
      slug: string
      name: string
      rarity: string | null
      origin_type: string | null
      origin_detail: string | null
      image_url: string | null
    }>

    return {
      items: rows.map((r) => ({
        ref: r.slug,
        name: r.name,
        aliases: [],
        facts: {
          rarity: r.rarity,
          // origin_detail is the specific source ("Jungle Egg", "Halloween
          // Event 2019"); origin_type is the coarse bucket ("egg", "event").
          // Prefer the specific one and say nothing when neither exists.
          obtainedFrom: r.origin_detail || r.origin_type || null,
        },
        imageUrl: r.image_url,
      })),
      variants: VARIANTS.map((ref) => ({ ref, label: VARIANT_LABEL[ref], note: VARIANT_NOTE[ref] })),
    }
  },

  async loadMarketPrices(client: ImportReader) {
    // The values table keys on pet_id; the importer keys on slug, so the pet
    // row comes along for the ride. One query for the whole catalogue.
    //
    // Paged, and this is the one that bit (2026-10-10): 4,016 value rows
    // against PostgREST's silent 1,000-row cap meant three in four pets came
    // back "no market price" — Panda, Kangaroo, Giraffe and Strawberry
    // Shortcake Bat Dragon all had live prices. The ORDER BY ends on the
    // unique id so pages never overlap or skip.
    const { data, error } = await fetchAllRows((from, to) =>
      client
        .from('adopt_me_pet_values')
        .select('variant, cheapest_usd, average_usd, is_estimated, listings_tracked, adopt_me_pets!inner(slug)')
        .order('id')
        .range(from, to),
    )
    if (error) throw new Error(`adopt-me prices: ${(error as { message?: string }).message ?? error}`)

    const rows = (data ?? []) as Array<{
      variant: string
      cheapest_usd: number | null
      average_usd: number | null
      is_estimated: boolean | null
      listings_tracked: number | null
      adopt_me_pets: { slug: string } | { slug: string }[]
    }>

    const out = new Map<string, MarketPrice>()
    for (const r of rows) {
      const pet = Array.isArray(r.adopt_me_pets) ? r.adopt_me_pets[0] : r.adopt_me_pets
      if (!pet?.slug) continue
      // Cheapest is the headline everywhere else on the site (it is what a
      // buyer can actually pay today); average is the fallback.
      const usd = r.cheapest_usd ?? r.average_usd
      if (usd == null || usd <= 0) continue
      out.set(priceKey(pet.slug, r.variant), {
        usd,
        estimated: r.is_estimated === true,
        sampleSize: r.listings_tracked,
      })
    }
    return out
  },

  // 'FR' / 'NFR' are what `adopt_me_pet_values.variant` stores AND what players
  // type into Google, so the code goes in the title and the snippet spells it
  // out once as "Fly Ride (FR)".
  variantStyle: 'code',

  title: ({ item, variant }) =>
    buildTitle(
      {
        itemName: item.name,
        variantToken: variantTitleToken(variant, 'code'),
        variantLabel: variant?.label ?? null,
        gameName: GAME_NAME,
        itemNoun: 'pet',
      },
      item.ref,
    ),

  description: ({ item, variant }) =>
    buildDescription({
      item,
      variant,
      variantStyle: 'code',
      gameName: GAME_NAME,
      itemNoun: 'pet',
      delivery: DELIVERY,
    }),
}
