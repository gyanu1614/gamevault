/**
 * Admin "Variant Mismatches": active Adopt Me listings whose title names a
 * different variant than the seller's Trait pick (rule: lib/adopt-me/trait-hint),
 * and the fix: switch the pick to the choice the title names. The caller then
 * re-links through THE link (`linkListingsToValueItems`) and revalidates.
 *
 * Admin-only and on demand (the page opens, a button is pressed). Nothing here
 * runs on a public request or on a seller's publish/edit. One game, active
 * only, a trait picked: `idx_listings_full_filter (game_id …) WHERE active`.
 * Takes the service-role client; no `@/` imports.
 */
import { AM_TRAIT_FIELD, savedTraitMismatch, traitHintText, type TraitChoice } from '../adopt-me/trait-hint'
import { VARIANT_LABEL } from '../adopt-me/variants'
import { loadOptionLabels, loadValueCatalog } from './catalogs'

type AnyClient = { from: (table: string) => any }

export interface VariantMismatch {
  id: string
  title: string
  sellerId: string | null
  itemSlug: string | null
  /** The stored choice code and its label today (null: the field no longer offers it). */
  picked: string
  pickedLabel: string | null
  /** What the title says, as a buyer reads it ("Fly Ride"). */
  titleSays: string
  switchTo: TraitChoice
  text: string
  templateData: Record<string, unknown>
}

const PAGE = 1000
/** Safety stop: 50k active Adopt Me listings. */
const MAX_PAGES = 50
/** One UPDATE per row (each row's other fields differ); this many at a time. */
const WRITE_BATCH = 8

interface Row {
  id: string
  title: string | null
  seller_id: string | null
  game_category_id: string | null
  value_item_slug: string | null
  template_data: Record<string, unknown> | null
}

export async function findVariantMismatches(client: AnyClient, opts: { ids?: readonly string[] } = {}): Promise<VariantMismatch[]> {
  const { data: game, error: gameError } = await client.from('games').select('id, slug').eq('slug', 'adopt-me').maybeSingle()
  if (gameError) throw gameError
  if (!game) return []
  const loaded = await loadValueCatalog(client, game)
  const names = new Map((loaded?.items ?? []).map((i) => [i.slug, i.name]))
  const labels = new Map<string, Promise<Record<string, Record<string, string>>>>()

  const out: VariantMismatch[] = []
  let after = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = client
      .from('listings')
      .select('id, title, seller_id, game_category_id, value_item_slug, template_data')
      .eq('game_id', game.id)
      .eq('status', 'active')
      .not(`template_data->>${AM_TRAIT_FIELD}`, 'is', null)
      .order('id')
    if (opts.ids) q = q.in('id', opts.ids)
    if (after) q = q.gt('id', after)
    const { data, error } = await q.limit(PAGE)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    for (const r of rows) {
      if (!r.game_category_id) continue
      if (!labels.has(r.game_category_id)) labels.set(r.game_category_id, loadOptionLabels(client, r.game_category_id))
      const fieldLabels = await labels.get(r.game_category_id)!
      const m = savedTraitMismatch({
        title: r.title ?? '',
        itemName: r.value_item_slug ? names.get(r.value_item_slug) : undefined,
        templateData: r.template_data,
        traitLabels: fieldLabels[AM_TRAIT_FIELD],
      })
      if (!m) continue
      out.push({
        id: r.id,
        title: r.title ?? '',
        sellerId: r.seller_id,
        itemSlug: r.value_item_slug,
        picked: m.picked,
        pickedLabel: m.pickedLabel,
        titleSays: VARIANT_LABEL[m.hint.titleVariant],
        switchTo: m.hint.choice,
        text: traitHintText(m.hint),
        templateData: r.template_data ?? {},
      })
    }
    if (rows.length < PAGE) break
    after = rows[rows.length - 1].id
  }
  return out.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

/**
 * Switch each listing's Trait pick to the choice its title names. Guarded on
 * the pick it was computed from: a seller who changed it meanwhile wins.
 */
export async function switchTraitPicks(
  client: AnyClient,
  rows: readonly VariantMismatch[],
): Promise<{ fixed: string[]; skipped: string[]; errors: string[] }> {
  const fixed: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    await Promise.all(
      rows.slice(i, i + WRITE_BATCH).map(async (r) => {
        const { data, error } = await client
          .from('listings')
          .update({ template_data: { ...r.templateData, [AM_TRAIT_FIELD]: r.switchTo.value } })
          .eq('id', r.id)
          .eq(`template_data->>${AM_TRAIT_FIELD}`, r.picked)
          .select('id')
        if (error) errors.push(`${r.id}: ${error.message}`)
        else if ((data ?? []).length === 0) skipped.push(r.id)
        else fixed.push(r.id)
      }),
    )
  }
  return { fixed, skipped, errors }
}
