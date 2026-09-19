/**
 * Draft item taxonomy from a game's Fandom wiki — read-only evidence for the
 * admin review card. Nothing here is written to a catalogue table.
 *
 * Fandom's MediaWiki API is keyless (`<slug>.fandom.com/api.php`). There is
 * no usable cross-wiki search — community.fandom.com is Cloudflare-blocked
 * (403) — so the wiki is found by trying slug variants of the title and
 * checking that the wiki's own sitename names the same game. Verified live
 * 2026-09-18: `stealanegg` 200 (188 articles) while `steal-an-egg` is 410.
 *
 * Draft = top content categories (`list=allcategories&acprop=size`, with a
 * stoplist for template/maintenance categories) + their first members
 * (`list=categorymembers`) + rarity tiers read from infobox `|rarity=` params
 * across one batched `prop=revisions` call.
 */
import { normalizeTitle, scoreCandidate } from '@/lib/games/icons'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const BOT_UA = 'DropMarketRadarBot/1.0 (+https://dropmarket.gg)'

export interface WikiRef {
  slug: string
  url: string
  sitename: string
  articles: number
}

export interface TaxonomyCategory {
  name: string
  size: number
  members: string[]
}

export interface TaxonomyDraft {
  found: boolean
  wiki?: WikiRef
  categories: TaxonomyCategory[]
  /** Distinct rarity tiers seen in infoboxes, in the order first seen. */
  rarities: string[]
  /** Category names that look like currencies (heuristic). */
  currencies: string[]
  generatedAt: string
  note?: string
}

// ── pure ───────────────────────────────────────────────────────────────────

export function wikiSlugCandidates(title: string): string[] {
  const words = normalizeTitle(title).split(' ').filter(Boolean)
  const concat = words.join('')
  const hyphen = words.join('-')
  const out = [concat, hyphen, `${concat}-roblox`]
  return out.filter((s, i) => s && out.indexOf(s) === i)
}

export function parseSiteInfo(body: unknown): { sitename: string; articles: number; server: string; lang: string } | null {
  const q = (body as { query?: { general?: Record<string, unknown>; statistics?: Record<string, unknown> } })?.query
  const g = q?.general
  if (!g || typeof g.sitename !== 'string' || typeof g.server !== 'string') return null
  const articles = q?.statistics?.articles
  return {
    sitename: g.sitename,
    articles: typeof articles === 'number' ? articles : 0,
    server: g.server.startsWith('//') ? `https:${g.server}` : g.server,
    lang: typeof g.lang === 'string' ? g.lang : 'en',
  }
}

/** "Steal An Egg Wiki" names "Steal an Egg"; "Steal a Brainrot Wiki" does not. */
export function siteNameMatches(title: string, sitename: string): boolean {
  const cleaned = sitename.replace(/\b(official\s+)?wiki(a)?\b/gi, '').trim()
  return scoreCandidate(title, cleaned) >= 0.9
}

/** Categories that describe the wiki, not the game. */
const CATEGORY_STOPLIST =
  /template|infobox|stub|candidate|image|file|licen|notice|policy|policies|help|blog|user|admin|wiki|community|browse|site|maintenance|disambiguation|redirect|hidden|sandbox|forum|meta|navbox|module|gallery|article|page/i

export function parseAllCategories(body: unknown): { name: string; size: number }[] {
  const list = (body as { query?: { allcategories?: { '*'?: string; size?: number }[] } })?.query?.allcategories
  if (!Array.isArray(list)) return []
  return list
    .filter((c): c is { '*': string; size?: number } => typeof c['*'] === 'string')
    .map((c) => ({ name: c['*'], size: typeof c.size === 'number' ? c.size : 0 }))
    .filter((c) => c.size > 0 && !CATEGORY_STOPLIST.test(c.name))
    .sort((a, b) => b.size - a.size)
}

export function parseCategoryMembers(body: unknown): string[] {
  const list = (body as { query?: { categorymembers?: { title?: string }[] } })?.query?.categorymembers
  if (!Array.isArray(list)) return []
  return list.map((m) => m.title).filter((t): t is string => typeof t === 'string')
}

export function extractRarities(body: unknown): { byTitle: Map<string, string>; tiers: string[] } {
  const byTitle = new Map<string, string>()
  const tiers: string[] = []
  const pages = (body as { query?: { pages?: unknown } })?.query?.pages
  const arr: { title?: string; revisions?: { slots?: { main?: { content?: string } }; '*'?: string }[] }[] =
    Array.isArray(pages) ? pages : pages && typeof pages === 'object' ? Object.values(pages as object) : []
  for (const p of arr) {
    if (typeof p.title !== 'string') continue
    const rev = p.revisions?.[0]
    const text = rev?.slots?.main?.content ?? rev?.['*'] ?? ''
    const m = text.match(/\|\s*rarity\s*=\s*([A-Za-z][A-Za-z ]{0,30}?)\s*(?:\||\}\}|\n)/)
    if (!m) continue
    const tier = m[1].trim()
    byTitle.set(p.title, tier)
    if (!tiers.includes(tier)) tiers.push(tier)
  }
  return { byTitle, tiers }
}

const CURRENCY_HINT = /currenc|coin|gem|token|cash|money|buck|shard|crystal|point/i

// ── IO ─────────────────────────────────────────────────────────────────────

export interface FandomDeps {
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  maxCategories?: number
  membersPerCategory?: number
  now?: () => Date
}

async function api(base: string, params: Record<string, string>, fetchImpl: FetchLike): Promise<unknown | null> {
  const q = new URLSearchParams({ format: 'json', ...params })
  const res = await fetchImpl(`${base}/api.php?${q.toString()}`, { headers: { 'User-Agent': BOT_UA } })
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function findWiki(title: string, deps: FandomDeps = {}): Promise<WikiRef | null> {
  const { fetchImpl = fetch } = deps
  for (const slug of wikiSlugCandidates(title)) {
    const base = `https://${slug}.fandom.com`
    const info = parseSiteInfo(
      await api(base, { action: 'query', meta: 'siteinfo', siprop: 'general|statistics' }, fetchImpl).catch(() => null),
    )
    if (!info) continue
    if (!siteNameMatches(title, info.sitename)) continue
    return { slug, url: info.server, sitename: info.sitename, articles: info.articles }
  }
  return null
}

export async function draftTaxonomy(title: string, deps: FandomDeps = {}): Promise<TaxonomyDraft> {
  const {
    fetchImpl = fetch,
    sleep = (ms) => new Promise<void>((r) => setTimeout(r, ms)),
    maxCategories = 3,
    membersPerCategory = 50,
    now = () => new Date(),
  } = deps
  const generatedAt = now().toISOString()

  const wiki = await findWiki(title, deps)
  if (!wiki) {
    return { found: false, categories: [], rarities: [], currencies: [], generatedAt, note: 'No Fandom wiki found for this title.' }
  }

  const cats = parseAllCategories(
    await api(wiki.url, { action: 'query', list: 'allcategories', acprop: 'size', aclimit: '500' }, fetchImpl),
  )
  const currencies = cats.filter((c) => CURRENCY_HINT.test(c.name)).map((c) => c.name)

  const categories: TaxonomyCategory[] = []
  for (const c of cats.slice(0, maxCategories)) {
    await sleep(250)
    const members = parseCategoryMembers(
      await api(
        wiki.url,
        { action: 'query', list: 'categorymembers', cmtitle: `Category:${c.name}`, cmlimit: String(membersPerCategory), cmnamespace: '0' },
        fetchImpl,
      ),
    )
    categories.push({ name: c.name, size: c.size, members })
  }

  let rarities: string[] = []
  const sample = categories[0]?.members.slice(0, 40) ?? []
  if (sample.length > 0) {
    await sleep(250)
    const revs = await api(
      wiki.url,
      { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', formatversion: '2', titles: sample.join('|') },
      fetchImpl,
    )
    rarities = extractRarities(revs).tiers
  }

  return { found: true, wiki, categories, rarities, currencies, generatedAt }
}
