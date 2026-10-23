/**
 * Murder Mystery 2 catalogue adapter: weapon and pet pages on
 * murder-mystery-2.fandom.com → values_items rows. Parsing is the weekly
 * importer's (src/lib/values/catalogue/mm2-wiki.ts buildMm2Catalogue: infobox,
 * type, rarity, chroma → base, box odds and prices), one page at a time, plus
 * a How To Get written from the structured obtain data (mm2-how-to-get.ts).
 * The infobox value= / tier= community values are never taken.
 */
import { mm2HowToGet } from '../../values/catalogue/mm2-how-to-get'
import {
  buildMm2Catalogue,
  parseBoxPage,
  parseEventPassCost,
  parseImageFile,
  parseInfobox,
  parseRobuxPrice,
  type BoxPage,
  type ObtainCost,
  type ObtainSource,
} from '../../values/catalogue/mm2-wiki'
import { slugifyTitle } from '../plan'
import type { CatalogueAdapter, Db, ParsedItem, WikiPage } from '../types'
import { gameIdBySlug, insertValuesItems, loadValuesKnown, nextSortOrder, publicImageUrl } from './values-items'

const HOST = 'murder-mystery-2.fandom.com'
const GAME = 'murder-mystery-2'
const BUCKET = 'values-items'
const LICENSE = 'CC-BY-SA 3.0'
/** The image retry only looks at rows this young (older imageless rows are an admin's call). */
const RETRY_DAYS = 30
/** Source pages one run may read for prices (gamepasses, event passes). */
const MAX_ENRICH_PAGES = 10

const pageUrl = (title: string) => `https://${HOST}/wiki/${encodeURI(title.replace(/ /g, '_'))}`

/** One wiki page → its item, or null (no infobox, no weapon/pet type, scrapped, an event or box page). */
export function parseMm2Page(page: WikiPage, boxes: BoxPage[], checkedAt: string): ParsedItem | null {
  const item = buildMm2Catalogue([{ title: page.title, wikitext: page.content }], boxes).items[0]
  if (!item) return null
  const url = pageUrl(page.title)
  return {
    pageId: page.pageId,
    revisionId: page.revisionId,
    wikiTitle: page.title,
    pageUrl: url,
    slug: item.slug,
    name: item.name,
    rarity: item.rarity,
    imageFile: item.imageFile,
    // MM2 pages give a year, not a date: kept in extra.releaseYear (values_items.release_year).
    releasedAt: null,
    origin: item.origin,
    howToGet: mm2HowToGet(item, url, checkedAt),
    extra: {
      itemType: item.itemType,
      isChroma: item.isChroma,
      baseTitle: item.isChroma ? page.title.replace(/^chroma\s+/i, '') : null,
      displayTitle: item.displayTitle,
      releaseYear: item.releaseYear,
      obtain: item.obtain,
    },
  }
}

/** Same credit line as scripts/import-mm2-wiki-catalogue.mjs. */
const attribution = (file: string) => `Image: Murder Mystery 2 Wiki (Fandom), ${LICENSE} — https://${HOST}/wiki/File:${encodeURI(file.replace(/ /g, '_'))}`
const TYPE_WORD: Record<string, string> = { knife: 'Knife', gun: 'Gun', pet: 'Pet', misc: 'Misc' }

/** Link each new Chroma to its standard item: "X", else "X (Knife)", same type, not itself a Chroma. */
async function linkChromas(db: Db, gameId: string, items: ParsedItem[], inserted: { id: string; slug: string }[]): Promise<void> {
  const chromas = items.filter((i) => i.extra.isChroma && i.extra.baseTitle && inserted.some((r) => r.slug === i.slug))
  if (!chromas.length) return
  const candidates = (i: ParsedItem) => {
    const base = i.extra.baseTitle as string
    return [slugifyTitle(base), slugifyTitle(`${base} (${TYPE_WORD[i.extra.itemType as string] ?? ''})`)]
  }
  const { data, error } = await db
    .from('values_items')
    .select('id,slug,item_type,rarity')
    .eq('game_id', gameId)
    .in('slug', chromas.flatMap(candidates))
  if (error) throw new Error(`values_items chroma bases: ${error.message}`)
  for (const chroma of chromas) {
    const base = candidates(chroma)
      .map((slug) => (data ?? []).find((r) => r.slug === slug))
      .find((r) => r && r.item_type === chroma.extra.itemType && r.rarity !== 'Chroma')
    const row = inserted.find((r) => r.slug === chroma.slug)
    if (!base || !row) continue
    const { error: upErr } = await db.from('values_items').update({ base_item_id: base.id }).eq('id', row.id)
    if (upErr) throw new Error(`values_items chroma link ${chroma.slug}: ${upErr.message}`)
  }
}

const obtainOf = (i: ParsedItem) => (i.extra.obtain as ObtainSource[] | undefined) ?? []
const sourceKey = (s: ObtainSource) => (s.wiki_page ?? s.name).toLowerCase()

export const murderMystery2: CatalogueAdapter = {
  gameSlug: 'murder-mystery-2',
  label: 'items',
  wikiHost: HOST,
  listQueries: [
    { list: 'categorymembers', title: 'Category:Weapons' },
    { list: 'categorymembers', title: 'Category:Pets' },
  ],

  /** Box pages (about 40, two requests): each new box item's odds and prices. */
  async prepare(wiki) {
    const listed = await wiki.listPages({ list: 'categorymembers', title: 'Category:Boxes' })
    const pages = await wiki.fetchPages(listed.filter((p) => p.title !== 'Boxes').map((p) => p.pageId))
    return { boxes: pages.map((p) => parseBoxPage(p.title, p.content)) }
  },

  parse: (page, ctx) => parseMm2Page(page, (ctx.boxes as BoxPage[] | undefined) ?? [], ctx.checkedAt),

  /** Gamepass / event-pass prices from their own pages, then the How To Get again. */
  async enrich(items, wiki, ctx) {
    const wanted = new Map<string, { title: string; kind: ObtainSource['kind'] }>()
    for (const item of items) {
      for (const s of obtainOf(item)) {
        if (!s.cost && (s.kind === 'gamepass' || s.kind === 'pass')) wanted.set(sourceKey(s), { title: s.wiki_page ?? s.name, kind: s.kind })
      }
    }
    const costs = new Map<string, ObtainCost>()
    for (const [key, { title, kind }] of [...wanted].slice(0, MAX_ENRICH_PAGES)) {
      const text = await wiki.wikitext(title).catch(() => '')
      const cost = kind === 'gamepass' ? parseRobuxPrice(text) : parseEventPassCost(text)
      if (cost) costs.set(key, cost)
    }
    if (!costs.size) return items
    return items.map((item) => {
      const obtain = obtainOf(item).map((s) => (s.cost ? s : { ...s, cost: costs.get(sourceKey(s)) ?? null }))
      const howToGet = mm2HowToGet({ obtain, releaseYear: (item.extra.releaseYear as number | null) ?? null, origin: item.origin }, item.pageUrl, ctx.checkedAt)
      return { ...item, howToGet, extra: { ...item.extra, obtain } }
    })
  },

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
        kind: 'item',
        item_type: item.extra.itemType ?? null,
        slug: item.slug,
        name: item.name,
        rarity: item.rarity,
        release_year: item.extra.releaseYear ?? null,
        origin: item.origin,
        obtain: item.extra.obtain ?? [],
        wiki_title: item.wikiTitle,
        how_to_get: item.howToGet,
        image_url: copied ? publicImageUrl(db, BUCKET, path) : null,
        image_attribution: copied && item.imageFile ? attribution(item.imageFile) : null,
        is_priced: true,
        is_enabled: true,
        sort_order: order++,
      })
    }
    const inserted = await insertValuesItems(db, rows)
    await linkChromas(db, gameId, items, inserted)
    return inserted.map((r) => r.slug)
  },

  /** values_items keeps no file name: read it again from the item's wiki page. */
  async fixMissingImages(db, images, wiki) {
    const gameId = await gameIdBySlug(db, GAME)
    const since = new Date(Date.now() - RETRY_DAYS * 86_400_000).toISOString()
    const { data, error } = await db
      .from('values_items')
      .select('id,slug,wiki_title')
      .eq('game_id', gameId)
      .is('image_url', null)
      .not('wiki_title', 'is', null)
      .gte('created_at', since)
      .limit(10)
    if (error) throw new Error(`values_items missing images: ${error.message}`)
    const fixed: string[] = []
    for (const row of data ?? []) {
      const text = await wiki.wikitext(row.wiki_title as string).catch(() => '')
      const file = parseImageFile(parseInfobox(text)?.image)
      const path = `${GAME}/${row.slug}.webp`
      if (!file || !(await images.copy(file, { bucket: BUCKET, path }))) continue
      const { error: upErr } = await db
        .from('values_items')
        .update({ image_url: publicImageUrl(db, BUCKET, path), image_attribution: attribution(file) })
        .eq('id', row.id)
      if (upErr) throw new Error(`values_items image ${row.slug}: ${upErr.message}`)
      fixed.push(row.slug as string)
    }
    return fixed
  },
}
