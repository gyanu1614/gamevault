/**
 * Adopt Me catalogue adapter: pet pages on adoptme.fandom.com ({{Pets}}
 * infobox) → adopt_me_pets rows plus their 8 empty form rows in
 * adopt_me_pet_values, the shape scripts/import-adoptmevalues.mjs inserted
 * before adoptmevalues.app stopped being scraped (2026-10-22). Facts (release
 * date, egg / event origin, How To Get) come from src/lib/adopt-me/wiki-facts.ts.
 *
 * Upcoming pets ("rarity = TBA", "is an upcoming pet") are skipped until the
 * release-day edit. trade_value and cash stay empty: the daily reprice fills
 * our own numbers. description stays null (the page rule is separate).
 */
import { buildAdoptMeFacts } from '../../adopt-me/wiki-facts'
import { plainText, templateBody, templateParams } from '../../wiki/markup'
import { firstImageFile } from '../files'
import { slugifyTitle } from '../plan'
import type { CatalogueAdapter, Db, KnownItem, ParsedItem, WikiPage } from '../types'
import { publicImageUrl } from './values-items'

const HOST = 'adoptme.fandom.com'
const BUCKET = 'adopt-me-pets'
const RETRY_DAYS = 30
/** A pet released this recently is on sale unless its page says otherwise. */
const NEW_PET_DAYS = 60
export const PET_VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
const RARITIES: Record<string, string> = { common: 'common', uncommon: 'uncommon', rare: 'rare', 'ultra rare': 'ultra_rare', 'ultra-rare': 'ultra_rare', legendary: 'legendary' }

/** Infobox rarity → the CHECK value; TBA / anything else → null. */
export function amRarity(raw: string | undefined): string | null {
  return RARITIES[plainText(raw ?? '').trim().toLowerCase()] ?? null
}

const pageUrl = (title: string) => `https://${HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

/** A pet page → its item; null for non-pet pages, subpages, unknown rarity and upcoming pets. */
export function parseAmPage(page: WikiPage, checkedAt: string): ParsedItem | null {
  if (page.title.includes('/')) return null
  const body = templateBody(page.content, 'Pets')
  if (body == null) return null
  const info = templateParams(body)
  const rarity = amRarity(info.rarity)
  if (!rarity || /\bis an upcoming\b/i.test(plainText(page.content).slice(0, 600))) return null
  const name = page.title.replace(/\s+\(Pet\)$/i, '')
  const slug = slugifyTitle(name)
  const categories = page.categories.map((c) => c.replace(/^Category:/, ''))
  const url = pageUrl(page.title)
  // Released within NEW_PET_DAYS → on sale now unless the page says it isn't.
  const lead = buildAdoptMeFacts({ slug, name, pageUrl: url, text: page.content, categories, dbObtainability: null, checkedAt })
  const fresh = lead.released_at != null && daysBetween(lead.released_at, checkedAt) <= NEW_PET_DAYS
  const facts = fresh ? buildAdoptMeFacts({ slug, name, pageUrl: url, text: page.content, categories, dbObtainability: 'obtainable', checkedAt }) : lead
  const gone = facts.how_to_get?.status === 'unobtainable' || /\boff-?sale\b/i.test(info.price ?? '')
  const limited = categories.some((c) => /^limited$/i.test(c))
  return {
    pageId: page.pageId,
    revisionId: page.revisionId,
    wikiTitle: page.title,
    pageUrl: url,
    slug,
    name,
    rarity,
    imageFile: firstImageFile(info.image),
    releasedAt: facts.released_at,
    origin: facts.origin_detail,
    howToGet: facts.how_to_get,
    extra: { obtainability: gone ? 'unobtainable' : limited ? 'limited' : 'obtainable', originType: facts.origin_type },
  }
}

async function petImageFromWiki(wiki: { wikitext(title: string): Promise<string> }, name: string): Promise<string | null> {
  for (const title of [name, `${name} (Pet)`]) {
    const text = await wiki.wikitext(title).catch(() => '')
    const file = firstImageFile(templateParams(templateBody(text, 'Pets')).image)
    if (file) return file
  }
  return null
}

async function insertForms(db: Db, petIds: string[]): Promise<void> {
  if (!petIds.length) return
  const rows = petIds.flatMap((pet_id) =>
    PET_VARIANTS.map((variant) => ({ pet_id, variant, trade_value: null, cash_value_usd: null, listings_tracked: 0, confidence: 'low', is_estimated: true, last_priced_at: null })),
  )
  const { error } = await db.from('adopt_me_pet_values').upsert(rows, { onConflict: 'pet_id,variant', ignoreDuplicates: true })
  if (error) throw new Error(`adopt_me_pet_values insert: ${error.message}`)
}

export const adoptMe: CatalogueAdapter = {
  gameSlug: 'adopt-me',
  label: 'pets',
  wikiHost: HOST,
  listQueries: [{ list: 'categorymembers', title: 'Category:Pets' }],
  parse: (page, ctx) => parseAmPage(page, ctx.checkedAt),

  async loadKnown(db) {
    const out: KnownItem[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('adopt_me_pets').select('slug,name').order('slug').range(from, from + 999)
      if (error) throw new Error(`adopt_me_pets: ${error.message}`)
      for (const r of data ?? []) out.push({ slug: r.slug, name: r.name, pageId: null })
      if (!data || data.length < 1000) return out
    }
  },

  async insert(db, items, images) {
    const rows = []
    for (const item of items) {
      const path = `wiki/${item.slug}.webp`
      const copied = item.imageFile ? await images.copy(item.imageFile, { bucket: BUCKET, path }) : false
      rows.push({
        slug: item.slug,
        name: item.name,
        rarity: item.rarity,
        obtainability: item.extra.obtainability,
        origin_type: item.extra.originType ?? null,
        origin_detail: item.origin,
        released_at: item.releasedAt,
        how_to_get: item.howToGet,
        image_url: copied ? publicImageUrl(db, BUCKET, path) : null,
        demand_trend: 'stable',
        is_active: true,
      })
    }
    // ON CONFLICT (slug) DO NOTHING: an existing pet is never rewritten; only new rows come back.
    const { data, error } = await db.from('adopt_me_pets').upsert(rows, { onConflict: 'slug', ignoreDuplicates: true }).select('id,slug')
    if (error) throw new Error(`adopt_me_pets insert: ${error.message}`)
    await insertForms(db, (data ?? []).map((r) => r.id as string))
    return (data ?? []).map((r) => r.slug as string)
  },

  /** adopt_me_pets keeps no wiki title: read the page by name, then "Name (Pet)". */
  async fixMissingImages(db, images, wiki) {
    const since = new Date(Date.now() - RETRY_DAYS * 86_400_000).toISOString()
    const { data, error } = await db.from('adopt_me_pets').select('id,slug,name').is('image_url', null).gte('created_at', since).limit(10)
    if (error) throw new Error(`adopt_me_pets missing images: ${error.message}`)
    const fixed: string[] = []
    for (const row of data ?? []) {
      const file = await petImageFromWiki(wiki, row.name as string)
      const path = `wiki/${row.slug}.webp`
      if (!file || !(await images.copy(file, { bucket: BUCKET, path }))) continue
      const { error: upErr } = await db.from('adopt_me_pets').update({ image_url: publicImageUrl(db, BUCKET, path) }).eq('id', row.id)
      if (upErr) throw new Error(`adopt_me_pets image ${row.slug}: ${upErr.message}`)
      fixed.push(row.slug as string)
    }
    return fixed
  },
}
