/**
 * Steal a Brainrot catalogue adapter: every page on stealabrainrot.fandom.com
 * that uses the Brainrot Infobox → a sab_brainrots row shaped like the July
 * 2026 wiki import (source fields; `<slug>.webp` in the sab-brainrots bucket).
 * Facts (released, origin, How To Get) come from src/lib/sab/wiki-facts.ts,
 * the parser the value pages already use. A row without a copied image stays
 * `image_status='missing'`, which the public catalogue view hides.
 */
import { buildSabFacts, parseObtainment, parseUpdateLog, statusOf, type SabHowToGetStatus } from '../../sab/wiki-facts'
import { plainText, templateBody, templateParams } from '../../wiki/markup'
import { slugifyTitle } from '../plan'
import type { CatalogueAdapter, ParsedItem, WikiPage } from '../types'

const HOST = 'stealabrainrot.fandom.com'
const BUCKET = 'sab-brainrots'
const SOURCE_NAME = 'Steal a Brainrot Wiki'
/** source_payload.imported_by on rows this pipeline added. */
export const PIPELINE_MARK = 'catalogue-pipeline'
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Brainrot God', 'Secret', 'OG'] as const

/** Infobox rarity → our label ("Brainrot god" → "Brainrot God"); null when unknown. */
export function sabRarity(raw: string | undefined): string | null {
  const text = plainText(raw ?? '').trim().toLowerCase()
  return RARITIES.find((r) => r.toLowerCase() === text) ?? null
}

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15, qa: 1e15, qi: 1e18 }

/** "322.5K" → 322500, "$23.5B" → 23500000000; null when it isn't a plain amount. */
export function parseAmount(raw: string | undefined): number | null {
  const m = plainText(raw ?? '').replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)(qa|qi|[kmbtq])?(?:\/s)?$/i)
  if (!m) return null
  return Math.round(Number(m[1]) * (m[2] ? SUFFIX[m[2].toLowerCase()] : 1))
}

const OBTAINABILITY: Record<SabHowToGetStatus, 'obtainable' | 'limited' | 'unobtainable' | 'unknown'> = {
  obtainable: 'obtainable',
  seasonal: 'limited',
  unobtainable: 'unobtainable',
  unknown: 'unknown',
}

const pageUrl = (title: string) => `https://${HOST}/wiki/${encodeURI(title.replace(/ /g, '_'))}`

/**
 * A brainrot page → its item. Null for subpages (/Gallery), pages without the
 * infobox or a known rarity, and announced-but-unreleased brainrots; the run
 * records those as ignored and looks again when the page is edited.
 */
export function parseSabPage(page: WikiPage, updates: Map<number, string>, checkedAt: string): ParsedItem | null {
  if (page.title.includes('/')) return null
  const body = templateBody(page.content, 'Brainrot Infobox')
  if (body == null) return null
  const info = templateParams(body)
  const rarity = sabRarity(info.rarity)
  if (!rarity || parseObtainment(page.content)?.upcoming) return null
  const slug = slugifyTitle(page.title)
  const url = pageUrl(page.title)
  const categories = page.categories.map((c) => c.replace(/^Category:/, ''))
  const facts = buildSabFacts({ slug, pageUrl: url, text: page.content, categories, updates, checkedAt })
  const image = plainText(info.image1 ?? info.image ?? '').replace(/^file:/i, '').trim()
  return {
    pageId: page.pageId,
    revisionId: page.revisionId,
    wikiTitle: page.title,
    pageUrl: url,
    slug,
    name: page.title,
    rarity,
    imageFile: image || null,
    releasedAt: facts.released_at,
    origin: facts.origin,
    howToGet: facts.how_to_get,
    extra: {
      income: parseAmount(info.income),
      cost: parseAmount(info.cost),
      obtainability: OBTAINABILITY[facts.how_to_get?.status ?? statusOf(info.status)],
      categories,
    },
  }
}

/** The sab_brainrots row for a new brainrot. */
export function sabRow(item: ParsedItem, imagePath: string | null, verifiedAt: string) {
  return {
    name: item.name,
    slug: item.slug,
    rarity: item.rarity,
    base_income_per_second: item.extra.income ?? null,
    ingame_cost: item.extra.cost ?? null,
    obtainability: item.extra.obtainability ?? 'unknown',
    image_path: imagePath,
    image_alt_text: `${item.name} Steal a Brainrot`,
    image_status: imagePath ? 'approved' : 'missing',
    source_name: SOURCE_NAME,
    source_url: item.pageUrl,
    source_page_id: item.pageId,
    source_revision_id: item.revisionId,
    source_payload: { source_categories: item.extra.categories ?? [], image_file: item.imageFile, imported_by: PIPELINE_MARK },
    released_at: item.releasedAt,
    origin: item.origin,
    how_to_get: item.howToGet,
    needs_review: false,
    is_active: true,
    game_data_last_verified_at: verifiedAt,
  }
}

export const stealABrainrot: CatalogueAdapter = {
  gameSlug: 'steal-a-brainrot',
  label: 'brainrots',
  wikiHost: HOST,
  listQueries: [{ list: 'embeddedin', title: 'Template:Brainrot Infobox' }],
  async prepare(wiki) {
    const updates = parseUpdateLog(await wiki.wikitext('Update_Log'))
    // Under 10 updates means the page changed shape: fail loudly rather than add brainrots without dates.
    if (updates.size < 10) throw new Error(`Update Log parsed to ${updates.size} updates, so the page changed shape`)
    return { updates }
  },
  parse: (page, ctx) => parseSabPage(page, ctx.updates as Map<number, string>, ctx.checkedAt),
  loadKnown: async () => {
    throw new Error('steal-a-brainrot loadKnown: not wired yet')
  },
  insert: async () => {
    throw new Error('steal-a-brainrot insert: not wired yet')
  },
}
