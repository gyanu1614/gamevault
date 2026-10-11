/**
 * Steal An Egg — bulk import config.
 *
 * Catalogue: `values_items` for this game (+ `values_item_aliases`).
 * Variants: NONE. This market sells sealed random eggs priced by area, not
 *           named pets with a variant axis (Step 3's audit measured 76% of
 *           listings naming an area and 1.5% naming a pet), so
 *           `variants: []` and the importer's variant column is ignored.
 * Prices:   `values_prices` (item_id) → cheapest_usd.
 *
 * `values_items.kind` distinguishes egg / area / pet / account_bracket. A pet
 * row is a catalogue page with `is_priced = false` and NO market price, so an
 * auto-priced pet row is rejected rather than invented — which is the same
 * rule the values pages already state on the methodology page.
 */
import { fetchAllRows } from '@/lib/db/fetch-all'
import { buildTitle, buildDescription } from '../copy'
import { priceKey, type GameImportConfig, type ImportReader, type ImportCatalogue, type MarketPrice } from '../types'

const GAME_NAME = 'Steal An Egg'
const errText = (e: unknown) => (e as { message?: string })?.message ?? String(e)
const DELIVERY = { method: 'manual' as const, window: '6hr' }

/** Kinds that can be sold as a listing. An `area` is a grouping, not stock. */
const SELLABLE_KINDS = new Set(['egg', 'pet', 'item', 'account_bracket'])

export const stealAnEggImportConfig: GameImportConfig = {
  gameSlug: 'steal-an-egg',
  categorySlug: 'items',
  itemNoun: 'egg',
  variantNoun: null,
  delivery: DELIVERY,
  // Step 3 already reads this wiki for the taxonomy; here it supplies the art
  // that values_items has no column value for yet.
  wikiHost: 'stealanegg.fandom.com',
  placeholderImage: '/icons/categories/items.svg',

  async loadCatalogue(client: ImportReader, gameId: string): Promise<ImportCatalogue> {
    // Paged: PostgREST cuts a response at 1,000 rows without saying so.
    const itemsRes = await fetchAllRows((from, to) =>
      client
        .from('values_items')
        .select('id, slug, name, kind, rarity, area, income_per_sec, image_url')
        .eq('game_id', gameId)
        .eq('is_enabled', true)
        .order('id')
        .range(from, to),
    )
    if (itemsRes.error) throw new Error(`steal-an-egg catalogue: ${errText(itemsRes.error)}`)

    const rows = ((itemsRes.data ?? []) as Array<{
      id: string
      slug: string
      name: string
      kind: string
      rarity: string | null
      area: string | null
      income_per_sec: number | null
      image_url: string | null
    }>).filter((r) => SELLABLE_KINDS.has(r.kind))

    // Filtered through the join on game_id rather than `.in(item_id, …every
    // id…)`: ~270 uuids is a ~10 KB query string, past what the gateway accepts.
    const aliasRes = await fetchAllRows((from, to) =>
      client
        .from('values_item_aliases')
        .select('item_id, alias, values_items!inner(game_id)')
        .eq('values_items.game_id', gameId)
        .order('id')
        .range(from, to),
    )
    if (aliasRes.error) throw new Error(`steal-an-egg aliases: ${errText(aliasRes.error)}`)

    const aliasesById = new Map<string, string[]>()
    for (const a of (aliasRes.data ?? []) as Array<{ item_id: string; alias: string }>) {
      const bucket = aliasesById.get(a.item_id)
      if (bucket) bucket.push(a.alias)
      else aliasesById.set(a.item_id, [a.alias])
    }

    return {
      items: rows.map((r) => ({
        ref: r.slug,
        name: r.name,
        aliases: aliasesById.get(r.id) ?? [],
        facts: {
          rarity: r.rarity,
          area: r.area,
          incomePerSec: r.income_per_sec,
          kind: r.kind,
        },
        imageUrl: r.image_url,
      })),
      variants: [],
    }
  },

  async loadMarketPrices(client: ImportReader, gameId: string) {
    // Paged; values_prices is keyed by item_id, which is unique.
    const { data, error } = await fetchAllRows((from, to) =>
      client
        .from('values_prices')
        .select('cheapest_usd, average_usd, sample_size, values_items!inner(slug)')
        .eq('game_id', gameId)
        .order('item_id')
        .range(from, to),
    )
    if (error) throw new Error(`steal-an-egg prices: ${errText(error)}`)

    const rows = (data ?? []) as Array<{
      cheapest_usd: number | null
      average_usd: number | null
      sample_size: number | null
      values_items: { slug: string } | { slug: string }[]
    }>

    const out = new Map<string, MarketPrice>()
    for (const r of rows) {
      const item = Array.isArray(r.values_items) ? r.values_items[0] : r.values_items
      if (!item?.slug) continue
      const usd = r.cheapest_usd ?? r.average_usd
      if (usd == null || usd <= 0) continue
      out.set(priceKey(item.slug, null), {
        usd,
        // Every published Steal An Egg value comes from live listings — the
        // pipeline writes nothing it could not observe (Step 3 §4).
        estimated: false,
        sampleSize: r.sample_size,
      })
    }
    return out
  },

  // No variant axis, so the style is never consulted; 'label' is the neutral
  // value rather than a meaningful choice.
  variantStyle: 'label',

  title: ({ item }) =>
    buildTitle(
      { itemName: item.name, variantToken: null, variantLabel: null, gameName: GAME_NAME, itemNoun: 'egg' },
      item.ref,
    ),

  description: ({ item }) =>
    buildDescription({
      item,
      variant: null,
      variantStyle: 'label',
      gameName: GAME_NAME,
      itemNoun: 'egg',
      // The one thing a buyer must know about this market: an egg is sealed.
      notes: item.facts.kind === 'egg' ? ['Sold sealed. The pet inside is random.'] : [],
      delivery: DELIVERY,
    }),
}
