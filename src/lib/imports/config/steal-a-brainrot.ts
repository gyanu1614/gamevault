/**
 * Steal a Brainrot — bulk import config.
 *
 * Catalogue: `sab_brainrots` (+ `sab_brainrot_aliases`, the reason SAB's market
 *            title matching works — the importer gets it for free).
 * Variants: `sab_mutations` (slug, name). A brainrot with no mutation is the
 *           plain item, which is a legitimate "no variant" row.
 * Prices:   `sab_price_display`, the materialised catalogue the price pages
 *           read. Already keyed by (brainrot_slug, mutation_slug), so no join.
 *
 * Images: `sab_brainrots.image_path` in the public `sab-brainrots` bucket, and
 * ONLY where `image_status = 'approved'` — the other states are un-reviewed
 * scrapes that the public catalogue view also hides. The URL is built from the
 * configured Supabase URL rather than taken from `sab_brainrot_catalog`, whose
 * expression hard-codes the production project host (pre-existing; not changed
 * here, but it would hand a local run production URLs).
 */
import { fetchAllRows } from '@/lib/db/fetch-all'
import { buildTitle, buildDescription, variantTitleToken } from '../copy'
import { priceKey, type GameImportConfig, type ImportReader, type ImportCatalogue, type MarketPrice } from '../types'

const GAME_NAME = 'Steal a Brainrot'
const errText = (e: unknown) => (e as { message?: string })?.message ?? String(e)
const DELIVERY = { method: 'manual' as const, window: '1hr' }
const IMAGE_BUCKET = 'sab-brainrots'

function bucketUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || !path) return null
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`
}

export const stealABrainrotImportConfig: GameImportConfig = {
  gameSlug: 'steal-a-brainrot',
  categorySlug: 'items',
  itemNoun: 'brainrot',
  variantNoun: 'mutation',
  delivery: DELIVERY,
  wikiHost: 'stealabrainrot.fandom.com',
  placeholderImage: '/icons/categories/items.svg',

  async loadCatalogue(client: ImportReader): Promise<ImportCatalogue> {
    // Every read paged: PostgREST cuts a response at 1,000 rows without saying
    // so, and the alias table alone is past that. Each ORDER BY ends on id.
    const [itemsRes, aliasRes, mutationsRes] = await Promise.all([
      fetchAllRows((from, to) =>
        client
          .from('sab_brainrots')
          .select('id, slug, name, rarity, aliases, base_income_per_second, acquisition_method, obtainability, image_path, image_status')
          .eq('is_active', true)
          .eq('needs_review', false)
          .order('id')
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        client
          .from('sab_brainrot_aliases')
          .select('brainrot_id, alias')
          .eq('is_active', true)
          .order('id')
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        client
          .from('sab_mutations')
          .select('slug, name, income_multiplier')
          .eq('is_active', true)
          .order('id')
          .range(from, to),
      ),
    ])
    if (itemsRes.error) throw new Error(`sab catalogue: ${errText(itemsRes.error)}`)
    if (aliasRes.error) throw new Error(`sab aliases: ${errText(aliasRes.error)}`)
    if (mutationsRes.error) throw new Error(`sab mutations: ${errText(mutationsRes.error)}`)

    const rows = (itemsRes.data ?? []) as Array<{
      id: string
      slug: string
      name: string
      rarity: string | null
      aliases: string[] | null
      base_income_per_second: number | null
      acquisition_method: string | null
      obtainability: string | null
      image_path: string | null
      image_status: string | null
    }>

    const aliasesById = new Map<string, string[]>()
    for (const a of (aliasRes.data ?? []) as Array<{ brainrot_id: string; alias: string }>) {
      const bucket = aliasesById.get(a.brainrot_id)
      if (bucket) bucket.push(a.alias)
      else aliasesById.set(a.brainrot_id, [a.alias])
    }

    return {
      items: rows.map((r) => ({
        ref: r.slug,
        name: r.name,
        // Both alias sources: the column on the row and the dedicated table.
        aliases: [...(r.aliases ?? []), ...(aliasesById.get(r.id) ?? [])],
        facts: {
          rarity: r.rarity,
          obtainedFrom: r.acquisition_method || r.obtainability || null,
          incomePerSec: r.base_income_per_second,
        },
        // Un-reviewed art is not shown on the public catalogue; do not put it
        // on a listing either. The image step falls back to the wiki.
        imageUrl: r.image_status === 'approved' ? bucketUrl(r.image_path) : null,
      })),
      variants: ((mutationsRes.data ?? []) as Array<{ slug: string; name: string; income_multiplier: number | null }>)
        .map((m) => ({
          ref: m.slug,
          label: m.name,
          // The game's own number, straight from the catalogue: what a buyer
          // actually gets from this mutation. Nothing said when it is unknown
          // or neutral.
          note:
            typeof m.income_multiplier === 'number' && m.income_multiplier > 0 && m.income_multiplier !== 1
              ? `${m.name} mutation: earns ${Number(m.income_multiplier.toFixed(2))}× the base income.`
              : null,
        })),
    }
  },

  async loadMarketPrices(client: ImportReader) {
    // Paged: one row per (brainrot, mutation) is thousands of rows. Ordered by
    // the table's primary key (brainrot_id, mutation_slug) so pages are stable.
    const { data, error } = await fetchAllRows((from, to) =>
      client
        .from('sab_price_display')
        .select('brainrot_slug, mutation_slug, cheapest_usd, market_value_usd, is_public_estimate, external_sample_size')
        .order('brainrot_id')
        .order('mutation_slug')
        .range(from, to),
    )
    if (error) throw new Error(`sab prices: ${errText(error)}`)

    const rows = (data ?? []) as Array<{
      brainrot_slug: string | null
      mutation_slug: string | null
      cheapest_usd: number | null
      market_value_usd: number | null
      is_public_estimate: boolean | null
      external_sample_size: number | null
    }>

    const out = new Map<string, MarketPrice>()
    for (const r of rows) {
      if (!r.brainrot_slug) continue
      const usd = r.cheapest_usd ?? r.market_value_usd
      if (usd == null || usd <= 0) continue
      out.set(priceKey(r.brainrot_slug, r.mutation_slug ?? null), {
        usd,
        estimated: r.is_public_estimate === true,
        sampleSize: r.external_sample_size,
      })
    }
    return out
  },

  // A mutation's ref is a slug ('gold'), so copy uses its NAME. There is no
  // short code the community searches for the way Adopt Me has FR/NFR.
  variantStyle: 'label',

  title: ({ item, variant }) =>
    buildTitle(
      {
        itemName: item.name,
        variantToken: variantTitleToken(variant, 'label'),
        variantLabel: variant?.label ?? null,
        gameName: GAME_NAME,
        itemNoun: 'brainrot',
      },
      item.ref,
    ),

  description: ({ item, variant }) =>
    buildDescription({
      item,
      variant,
      variantStyle: 'label',
      gameName: GAME_NAME,
      itemNoun: 'brainrot',
      delivery: DELIVERY,
    }),
}
