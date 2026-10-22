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
  parseRobuxPrice,
  type BoxPage,
  type ObtainCost,
  type ObtainSource,
} from '../../values/catalogue/mm2-wiki'
import type { CatalogueAdapter, ParsedItem, WikiPage } from '../types'

const HOST = 'murder-mystery-2.fandom.com'
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

  loadKnown: async () => {
    throw new Error('murder-mystery-2 loadKnown: not wired yet')
  },
  insert: async () => {
    throw new Error('murder-mystery-2 insert: not wired yet')
  },
}
