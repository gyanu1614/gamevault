/**
 * Murder Mystery 2 catalogue from the MM2 Fandom wiki (MediaWiki API,
 * CC-BY-SA 3.0) — pure parsing; the fetching lives in
 * scripts/import-mm2-wiki-catalogue.mjs.
 *
 * What we take: name, type, rarity, chroma → base link, image file, and a
 * STRUCTURED how-to-get (boxes with odds + cost, event passes, gamepasses,
 * crafting, codes). What we never take: the infobox `value=` and `tier=`
 * fields — those are community trade values (mm2values / supreme) we have no
 * permission to republish. Our values are USD from live listings only.
 *
 * Pure; no `@/` imports (loaded by tsx scripts).
 */
import { comparableName } from '../normalisers/eldorado-structured'

export type ObtainKind = 'box' | 'event' | 'pass' | 'gamepass' | 'crafting' | 'code' | 'shop' | 'unobtainable' | 'other'

export interface ObtainCost {
  amount: number
  currency: string
}

/** One way an item was / is obtained. Stored as an array in values_items.obtain. */
export interface ObtainSource {
  kind: ObtainKind
  /** "Knife Box 2", "Halloween Event 2021", "Elite Gamepass". */
  name: string
  year: number | null
  /** How, within the source: "Tier Reward", "Battle Pass", "Unbox", "Leaderboard". */
  method: string | null
  cost: ObtainCost | null
  /** Other prices for the same source (a box sold for coins OR diamonds OR a key). */
  alt_costs?: ObtainCost[]
  /** Chance as the wiki lists it for this item's row (the rarity tier's chance); null unless exact. */
  odds_pct: number | null
  /** The chance exactly as listed ("0.2%", "<0.2%") — kept when it is a bound, not a number. */
  odds_text?: string | null
  still_obtainable: boolean
  /** Wiki page for the source, when linked. */
  wiki_page: string | null
}

export interface BoxReward {
  title: string
  rarity: string | null
  chancePct: number | null
  /** As listed ("0.004%", "<0.2%"). */
  chanceText: string | null
}

export interface BoxPage {
  title: string
  purchasable: boolean
  costs: ObtainCost[]
  rewards: BoxReward[]
}

export interface Mm2CatalogueItem {
  slug: string
  name: string
  wikiTitle: string
  displayTitle: string | null
  itemType: 'knife' | 'gun' | 'pet' | 'misc' | null
  rarity: string | null
  isChroma: boolean
  baseSlug: string | null
  releaseYear: number | null
  origin: string | null
  obtain: ObtainSource[]
  imageFile: string | null
}

// ── wikitext helpers ─────────────────────────────────────────────────────────

/** Split on `sep` at template/link depth 0. */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (let i = 0; i < text.length; i += 1) {
    const two = text.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth += 1
      buf += two
      i += 1
      continue
    }
    if ((two === '}}' || two === ']]') && depth > 0) {
      depth -= 1
      buf += two
      i += 1
      continue
    }
    if (depth === 0 && text[i] === sep) {
      out.push(buf)
      buf = ''
      continue
    }
    buf += text[i]
  }
  out.push(buf)
  return out
}

/** The `{{Infobox Item …}}` params, or null when the page has none. */
export function parseInfobox(wikitext: string): Record<string, string> | null {
  const start = wikitext.search(/\{\{\s*Infobox[ _]Item/i)
  if (start === -1) return null
  let depth = 0
  let end = -1
  for (let i = start; i < wikitext.length - 1; i += 1) {
    const two = wikitext.slice(i, i + 2)
    if (two === '{{') {
      depth += 1
      i += 1
    } else if (two === '}}') {
      depth -= 1
      i += 1
      if (depth === 0) {
        end = i - 1
        break
      }
    }
  }
  if (end === -1) return null
  const body = wikitext.slice(start + 2, end)
  const parts = splitTopLevel(body, '|').slice(1)
  const params: Record<string, string> = {}
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    if (!key || key in params) continue
    params[key] = part.slice(eq + 1).trim()
  }
  return params
}

/** Wikitext → plain text (links to their label, tags/templates/bold dropped). */
export function stripWiki(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim()
}

/** First `[[Target|…]]` link target in a line. */
function firstLinkTarget(raw: string): string | null {
  const m = raw.match(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/)
  if (!m) return null
  const target = m[1].trim()
  return /^(file|category|image):/i.test(target) ? null : target
}

export function slugifyTitle(title: string): string {
  return comparableName(title).replace(/ /g, '-')
}

// ── field parsers ────────────────────────────────────────────────────────────

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Godly', 'Ancient', 'Vintage', 'Unique', 'Chroma', 'Classic'] as const

/** Infobox rarity → one canonical tier, or null when the page is ambiguous/N/A. */
export function parseRarity(raw: string | null | undefined): string | null {
  const text = stripWiki(raw)
  if (!text || /n\/a|default/i.test(text)) return null
  // "Rare (Variant 1) … Godly (Variant 3)" — several rarities, no single answer.
  const found = RARITIES.filter((r) => new RegExp(`\\b${r}\\b`, 'i').test(text.split(/\(formerly/i)[0]))
  if (found.length !== 1) return null
  return found[0]
}

/** A single rarity category on the page ("Category:Godly"), else null. */
export function rarityFromCategories(categories: string[]): string | null {
  const found = RARITIES.filter((r) => categories.some((c) => c.toLowerCase() === r.toLowerCase() || c.toLowerCase() === `${r.toLowerCase()} weapons`))
  return found.length === 1 ? found[0] : null
}

/** Infobox type (or the page's categories) → knife | gun | pet | misc. */
export function parseItemType(raw: string | null | undefined, categories: string[] = []): Mm2CatalogueItem['itemType'] {
  const text = stripWiki(raw).toLowerCase()
  if (/\bknife\b|\bknives\b/.test(text)) return 'knife'
  if (/\bguns?\b/.test(text)) return 'gun'
  if (/\bpets?\b/.test(text)) return 'pet'
  const cats = categories.map((c) => c.toLowerCase())
  if (cats.includes('knives')) return 'knife'
  if (cats.includes('guns')) return 'gun'
  if (cats.includes('pets')) return 'pet'
  return null
}

/** "Adurite (Knife)" / "Bats Knife (2018)" / "Bat (Pet)" → the type the title states. */
export function typeFromTitle(title: string): Mm2CatalogueItem['itemType'] {
  const m = title.match(/\((Knife|Gun|Pet)\)\s*$/i) ?? title.match(/\s(Knife|Gun)\s+\([^)]*\)\s*$/i)
  return m ? (m[1].toLowerCase() as 'knife' | 'gun' | 'pet') : null
}

/** First image file named by an infobox `image=` (plain, [[File:]] or <gallery>). */
export function parseImageFile(raw: string | null | undefined): string | null {
  const text = String(raw ?? '')
  const file = text.match(/\[\[(?:File|Image):([^|\]]+)/i)?.[1]
  if (file) return file.trim()
  const line = text
    .replace(/<\/?gallery[^>]*>/gi, '\n')
    .split('\n')
    .map((l) => l.split('|')[0].trim())
    .find((l) => /\.(png|jpe?g|gif|webp)$/i.test(l))
  return line ? line.replace(/^(File|Image):/i, '').trim() : null
}

const YEAR_RE = /\b(20[1-3]\d)\b/
const EVENT_RE = /\b(Halloween|Christmas|Easter|Summer|Valentines?|Valentine's|Thanksgiving|Lunar New Year|Anniversary)\s+Event\s+(20[1-3]\d)\b/i
const FORMERLY_RE = /\((?:formerly|offsale|discontinued|retired)\)|\bformerly\b|\boffsale\b|\bdiscontinued\b/i

/** "1,000 Coins, 100 Diamonds or 1 Mystery Key" → costs, in order. */
export function parseCosts(text: string): ObtainCost[] {
  const out: ObtainCost[] = []
  const re = /(\d[\d,]*(?:\.\d+)?)\s+((?:Coins?|Diamonds?|Gems?|Candies|Candy|Robux|Tokens?|Snowflakes?|Hearts?|Eggs?|Shards?|Beach Balls?|Gifts?)|(?:[A-Z][a-z]+\s)?Keys?)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const amount = Number(m[1].replace(/,/g, ''))
    if (!Number.isFinite(amount)) continue
    out.push({ amount, currency: m[2].trim() })
  }
  return out
}

/** One infobox `obtain=` value → structured sources (Trading lines dropped). */
export function parseObtain(raw: string | null | undefined): ObtainSource[] {
  const lines = String(raw ?? '')
    .split(/\n|<br\s*\/?>/i)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: ObtainSource[] = []
  for (const rawLine of lines) {
    const text = stripWiki(rawLine).replace(/\s+/g, ' ').trim()
    if (!text || /^trading\b/i.test(text) || /^\w+=/.test(text)) continue
    const linked = firstLinkTarget(rawLine)
    const formerly = FORMERLY_RE.test(text)
    const year = Number(text.match(YEAR_RE)?.[1] ?? NaN)
    const base: Omit<ObtainSource, 'kind' | 'name'> = {
      year: Number.isFinite(year) ? year : null,
      method: null,
      cost: null,
      odds_pct: null,
      still_obtainable: !formerly,
      wiki_page: linked,
    }
    const clean = text.replace(/\s*\((?:formerly|offsale|discontinued|retired)\)\s*/gi, ' ').trim()
    const event = clean.match(EVENT_RE)
    const boxName =
      clean.match(/((?:20[1-3]\d\s+)?[A-Z][\w']*(?:\s+[A-Z][\w']*)*\s+(?:Box|Crate)(?:\s+\d+)?(?:\s+'\d{2})?)/)?.[1] ?? null
    const costs = parseCosts(clean)

    if (/^scrapped\b|\bscrapped\b/i.test(clean)) {
      out.push({ ...base, kind: 'unobtainable', name: 'Scrapped', still_obtainable: false })
    } else if (/gamepass|game pass/i.test(clean)) {
      const name = clean.match(/([A-Z][\w']*(?:\s+[A-Z][\w']*)*\s+Gamepass)/)?.[1] ?? 'Gamepass'
      out.push({ ...base, kind: 'gamepass', name, method: 'Purchase' })
    } else if (/\bcode\b/i.test(clean)) {
      out.push({ ...base, kind: 'code', name: 'Code', method: 'Redeem' })
    } else if (/^crafting$/i.test(clean) || (/\bcraft/i.test(clean) && !event)) {
      out.push({ ...base, kind: 'crafting', name: 'Crafting', method: 'Craft' })
    } else if (boxName) {
      // The linked page is the box's real name; the regex is the fallback.
      const name = linked && /\b(box|crate)\b/i.test(linked) ? linked : boxName.trim()
      out.push({ ...base, kind: 'box', name, method: 'Unbox', wiki_page: name })
    } else if (/\bhatch/i.test(clean) && /\begg\b/i.test(clean)) {
      const egg =
        (linked && /\begg\b/i.test(linked) ? linked : null) ??
        clean.match(/([A-Z][\w']*(?:\s+[A-Z][\w']*)*\s+Egg)\b/)?.[1]?.replace(/^Hatching\s+/i, '') ??
        'Egg'
      out.push({ ...base, kind: 'box', name: egg, method: 'Hatch', wiki_page: linked ?? egg })
    } else if (event) {
      const name = `${event[1][0].toUpperCase()}${event[1].slice(1)} Event ${event[2]}`
      const method = clean.split(/\s+-\s+/)[1]?.trim() || null
      const isPass = /battle\s?pass|tier reward|\btier\b/i.test(clean)
      out.push({ ...base, kind: isPass ? 'pass' : 'event', name, method, year: Number(event[2]), wiki_page: linked ?? name })
    } else if (/\bpack\b/i.test(clean)) {
      const name = clean.match(/([A-Z][\w']*(?:\s+[A-Z][\w']*)*\s+(?:Item\s+)?Pack)\b/)?.[1] ?? 'Item Pack'
      out.push({ ...base, kind: 'gamepass', name, method: 'Purchase' })
    } else if (/\bshop\b/i.test(clean) || costs.length) {
      out.push({ ...base, kind: 'shop', name: /murder mystery 1/i.test(clean) ? 'Murder Mystery 1 Shop' : 'Shop', method: 'Purchase', cost: costs[0] ?? null, ...(costs.length > 1 ? { alt_costs: costs.slice(1) } : {}) })
    } else {
      out.push({ ...base, kind: 'other', name: clean.slice(0, 120) })
    }
  }
  return out
}

/** A box page → cost(s), whether it is still sold, and its reward rows. */
export function parseBoxPage(title: string, wikitext: string): BoxPage {
  const intro = stripWiki(wikitext.split(/\n==/)[0]).replace(/\s+/g, ' ')
  // Present tense = still sold ("is currently purchasable", "can be purchased");
  // a past-tense page ("was a weapon box … it costed") is not.
  const purchasable =
    /\b(is|are)\s+(currently\s+)?(purchasable|available|sold)\b/i.test(intro) ||
    /\bcan be (purchased|bought)\b/i.test(intro)
  const rewards: BoxReward[] = []
  for (const table of wikitext.split(/\{\|/).slice(1)) {
    const body = table.split(/\n\|\}/)[0]
    for (const row of body.split(/\n\|-/).slice(1)) {
      const cells = row
        .split(/\n\|(?!\})|\|\|/)
        .map((c) => c.trim())
        .filter((c) => c && !c.startsWith('!'))
        // Drop a cell's style prefix: `style="…" |[[Fang]]`.
        .map((c) => c.replace(/^[^[|]*?style="[^"]*"\s*\|/, '').trim())
      const linkCell = cells.find((c) => /\[\[(?!File:|Image:)/i.test(c))
      if (!linkCell) continue
      const target = firstLinkTarget(linkCell)
      if (!target) continue
      const chanceCell = cells.find((c) => /^<?\s*[\d.]+\s*%\**$/.test(stripWiki(c)))
      const chanceText = chanceCell ? stripWiki(chanceCell).replace(/\*+$/, '') : null
      const rarityCell = cells.find((c) => RARITIES.some((r) => stripWiki(c).toLowerCase() === r.toLowerCase()))
      rewards.push({
        title: target,
        rarity: rarityCell ? stripWiki(rarityCell) : null,
        // "<0.2%" is a bound, not a chance: keep the text, never a number.
        chancePct: chanceText && /^[\d.]+\s*%$/.test(chanceText) ? Number(chanceText.replace('%', '')) : null,
        chanceText,
      })
    }
  }
  return { title, purchasable, costs: parseCosts(intro), rewards }
}

/** `[[Category:X]]` names on a page. */
export function pageCategories(wikitext: string): string[] {
  return [...wikitext.matchAll(/\[\[Category:([^|\]]+)/gi)].map((m) => m[1].trim())
}

export interface WikiPage {
  title: string
  wikitext: string
}

/**
 * Pages → catalogue rows. `boxes` enriches each box source with that box's
 * cost and this item's listed chance. Pages without an infobox, without a
 * resolvable type, or only "Scrapped" are skipped (never existed in-game).
 */
export function buildMm2Catalogue(pages: WikiPage[], boxes: BoxPage[] = []): { items: Mm2CatalogueItem[]; skipped: Array<{ title: string; reason: string }> } {
  const skipped: Array<{ title: string; reason: string }> = []
  const boxByTitle = new Map(boxes.map((b) => [b.title.toLowerCase(), b]))
  const parsed: Array<Mm2CatalogueItem & { _base: string | null }> = []
  const slugs = new Set<string>()

  for (const page of pages) {
    const box = parseInfobox(page.wikitext)
    if (!box) {
      skipped.push({ title: page.title, reason: 'no infobox' })
      continue
    }
    const categories = pageCategories(page.wikitext)
    // A type in the TITLE ("Pop Art (Knife)", "Bats Knife (2018)") beats an
    // infobox copied from the sibling page with the wrong `type=`.
    const itemType = typeFromTitle(page.title) ?? parseItemType(box.type, categories)
    if (!itemType) {
      skipped.push({ title: page.title, reason: `no item type (${stripWiki(box.type) || 'empty'})` })
      continue
    }
    const obtain = parseObtain(box.obtain ?? box.oqbtain)
    if (/\(scrapped\)/i.test(page.title) || (obtain.length > 0 && obtain.every((o) => o.kind === 'unobtainable'))) {
      skipped.push({ title: page.title, reason: 'scrapped' })
      continue
    }
    for (const source of obtain) {
      if (source.kind !== 'box') continue
      const boxPage = boxByTitle.get((source.wiki_page ?? source.name).toLowerCase())
      if (!boxPage) continue
      source.cost = boxPage.costs[0] ?? null
      if (boxPage.costs.length > 1) source.alt_costs = boxPage.costs.slice(1)
      const reward = boxPage.rewards.find((r) => r.title.toLowerCase() === page.title.toLowerCase())
      source.odds_pct = reward?.chancePct ?? null
      source.odds_text = reward?.chanceText ?? null
      // A box the wiki says is no longer sold cannot be a current source.
      if (!boxPage.purchasable) source.still_obtainable = false
    }

    const isChroma = /^chroma\s+/i.test(page.title) || /\bchroma\b/i.test(stripWiki(box.tier ?? ''))
    const displayTitle = stripWiki(box.title) || null
    const name = page.title.replace(/\s+\(Pet\)$/i, '')
    const slug = slugifyTitle(page.title)
    if (!slug || slugs.has(slug)) {
      skipped.push({ title: page.title, reason: 'duplicate slug' })
      continue
    }
    slugs.add(slug)
    const eventYears = categories.map((c) => Number(c.match(EVENT_RE)?.[2] ?? NaN)).filter(Number.isFinite)
    const years = [...obtain.map((o) => o.year).filter((y): y is number => y != null), ...eventYears]
    const firstSource = obtain.find((o) => o.kind !== 'other') ?? obtain[0]
    parsed.push({
      slug,
      name,
      wikiTitle: page.title,
      displayTitle: displayTitle && displayTitle !== page.title ? displayTitle : null,
      itemType,
      // Older pages put the tier in `type=` ("Godly Weapons") or only in categories.
      rarity: isChroma
        ? 'Chroma'
        : parseRarity(box.rarity) ?? parseRarity(box.type) ?? rarityFromCategories(categories),
      isChroma,
      baseSlug: null,
      releaseYear: years.length ? Math.min(...years) : null,
      origin: firstSource?.name ?? null,
      obtain,
      imageFile: parseImageFile(box.image),
      _base: isChroma ? page.title.replace(/^chroma\s+/i, '') : null,
    })
  }

  // Chroma → base: same title without "Chroma", else the type-qualified title.
  const byTitle = new Map(parsed.map((p) => [p.wikiTitle.toLowerCase(), p]))
  const typeWord: Record<string, string> = { knife: 'Knife', gun: 'Gun', pet: 'Pet', misc: 'Misc' }
  for (const p of parsed) {
    if (!p._base) continue
    const candidates = [p._base, `${p._base} (${typeWord[p.itemType ?? ''] ?? ''})`]
    const base = candidates.map((c) => byTitle.get(c.toLowerCase())).find((b) => b && !b.isChroma && b.itemType === p.itemType)
    p.baseSlug = base?.slug ?? null
  }
  return { items: parsed.map(({ _base, ...rest }) => rest), skipped }
}

/** "… purchasable for 499 Robux" — a gamepass page's price. */
export function parseRobuxPrice(wikitext: string): ObtainCost | null {
  const m = stripWiki(wikitext).match(/(\d[\d,]*)\s+Robux/i)
  return m ? { amount: Number(m[1].replace(/,/g, '')), currency: 'Robux' } : null
}

/** An event page's battle-pass price, when the page states one in Robux. */
export function parseEventPassCost(wikitext: string): ObtainCost | null {
  const text = stripWiki(wikitext).replace(/\s+/g, ' ')
  const m =
    text.match(/battle\s?pass[^.]{0,160}?(\d[\d,]*)\s+Robux/i) ??
    text.match(/(\d[\d,]*)\s+Robux[^.]{0,80}?battle\s?pass/i)
  return m ? { amount: Number(m[1].replace(/,/g, '')), currency: 'Robux' } : null
}

/** Fill gamepass / event-pass costs from their pages (keyed by lower-case title). */
export function applySourceCosts(items: Mm2CatalogueItem[], pageCosts: Map<string, ObtainCost>): void {
  for (const item of items) {
    for (const source of item.obtain) {
      if (source.cost || (source.kind !== 'gamepass' && source.kind !== 'pass')) continue
      const cost = pageCosts.get((source.wiki_page ?? source.name).toLowerCase())
      if (cost) source.cost = cost
    }
  }
}
