/**
 * Steal an Egg catalogue adapter: pet pages on stealanegg.fandom.com
 * ({{Detail}}) → values_items pets, shaped like scripts/seed-steal-an-egg.mjs
 * (`kind='pet'`, catalogue-only `is_priced=false`).
 *
 * The wiki's fields are loose (`egg_name=VOIDSEER`, a biome that is an egg),
 * so the adapter only ADDS PETS: a pet links to an egg we already hold when
 * the names agree, and egg / area rows (priced market items) are never
 * created from wiki text. No How To Get: the wiki states no availability.
 */
import { comparableName } from '../../values/normalisers/eldorado-structured'
import { plainText, templateBody, templateParams } from '../../wiki/markup'
import { parseAmount } from '../amounts'
import { slugifyTitle } from '../plan'
import type { CatalogueAdapter, ParsedItem, WikiPage } from '../types'
import { gameIdBySlug, insertValuesItems, loadValuesKnown, nextSortOrder, publicImageUrl } from './values-items'

const HOST = 'stealanegg.fandom.com'
const GAME = 'steal-an-egg'
const BUCKET = 'values-items'

const pageUrl = (title: string) => `https://${HOST}/wiki/${encodeURI(title.replace(/ /g, '_'))}`
const field = (p: Record<string, string>, k: string) => plainText(p[k] ?? '').trim() || null
/** A real file name ("Voidseer Pumpkin.png"), not the placeholder words some pages put there. */
const imageFile = (raw: string | null) => (raw && /\.(png|jpe?g|webp|gif)$/i.test(raw) ? raw.replace(/^file:/i, '').trim() : null)

/** A pet page → its item; null for subpages, pages without {{Detail}} and empty ones (no rarity, no income). */
export function parseSaePage(page: WikiPage): ParsedItem | null {
  if (page.title.includes('/')) return null
  const body = templateBody(page.content, 'Detail')
  if (body == null) return null
  const p = templateParams(body)
  const rarity = field(p, 'rarity')
  const income = parseAmount(p.mps)
  if (!rarity && income == null) return null
  const biome = field(p, 'biome')
  const area = biome && !/\begg\b/i.test(biome) ? biome : null
  return {
    pageId: page.pageId,
    revisionId: page.revisionId,
    wikiTitle: page.title,
    pageUrl: pageUrl(page.title),
    slug: slugifyTitle(page.title),
    name: page.title,
    rarity,
    imageFile: imageFile(field(p, 'pet_image')),
    releasedAt: null,
    origin: area,
    howToGet: null,
    extra: { area, income, eggName: field(p, 'egg_name') },
  }
}

export const stealAnEgg: CatalogueAdapter = {
  gameSlug: GAME,
  label: 'pets',
  wikiHost: HOST,
  listQueries: [{ list: 'categorymembers', title: 'Category:Pets' }],
  parse: (page) => parseSaePage(page),

  async loadKnown(db) {
    return loadValuesKnown(db, await gameIdBySlug(db, GAME))
  },

  async insert(db, items, images) {
    const gameId = await gameIdBySlug(db, GAME)
    let order = await nextSortOrder(db, gameId)
    const rows = []
    for (const item of items) {
      const path = `${GAME}/${item.slug}.webp`
      const copied = item.imageFile ? await images.copy(item.imageFile, { bucket: BUCKET, path }) : false
      rows.push({
        game_id: gameId,
        kind: 'pet',
        slug: item.slug,
        name: item.name,
        rarity: item.rarity,
        area: (item.extra.area as string | null) ?? null,
        income_per_sec: (item.extra.income as number | null) ?? null,
        image_url: copied ? publicImageUrl(db, BUCKET, path) : null,
        is_priced: false,
        sort_order: order++,
      })
    }
    const inserted = await insertValuesItems(db, rows)

    // Link to an egg we already sell: "Riftborn" or "Riftborn Egg" → "Riftborn Egg".
    const { data: eggs, error } = await db.from('values_items').select('id,name').eq('game_id', gameId).eq('kind', 'egg')
    if (error) throw new Error(`values_items eggs: ${error.message}`)
    const eggByName = new Map((eggs ?? []).map((e) => [comparableName(e.name as string), e.id as string]))
    for (const row of inserted) {
      const egg = items.find((i) => i.slug === row.slug)?.extra.eggName as string | null | undefined
      if (!egg) continue
      const id = eggByName.get(comparableName(egg)) ?? eggByName.get(comparableName(`${egg} Egg`))
      if (!id) continue
      const { error: upErr } = await db.from('values_items').update({ source_item_id: id }).eq('id', row.id)
      if (upErr) throw new Error(`values_items egg link ${row.slug}: ${upErr.message}`)
    }
    return inserted.map((r) => r.slug)
  },
}
