/**
 * Step 4 bulk importer — item art from a game's Fandom wiki.
 *
 * Every Fandom wiki exposes the same MediaWiki API, so one fetcher serves every
 * game; a config contributes only its host. Step 3 already reads the Steal An
 * Egg wiki for taxonomy through the same `api.php`, and this is the image half.
 *
 * WHICH image matters. The obvious query (`prop=pageimages`) returns the page's
 * LEAD image, which on a pet page is usually a gamepass banner or an event
 * thumbnail — verified 2026-09-30, where Shadow Dragon's lead image was
 * `Shadow Dragon Gamepass AM.png`. What a marketplace shows is the clean
 * per-item render: Eldorado serves `Frost Dragon Pet.png` for every Frost Dragon
 * offer, and the wiki carries a file of exactly that name. So this lists the
 * page's images and picks the render, rather than trusting the lead.
 *
 * Licence footing: identifier use — the item's own picture from the item's own
 * page, used to identify the thing being sold, the same basis on which the
 * values pages name and picture these items. The bytes are copied into our own
 * bucket (see images.ts) rather than hot-linked, so we are not leaning on their
 * bandwidth — and, as it happens, the Fandom CDN refuses hot-linked requests
 * anyway (404 + an image body, when a browser Referer is present).
 *
 * Network shape: ONE request per item, only for items whose catalogue has no
 * image, and only at apply time — never in a preview, which must stay instant.
 */

/** `redirects=1` follows "Frost dragon" → "Frost Dragon". */
function apiUrl(host: string, title: string): string {
  const q = new URLSearchParams({
    action: 'query',
    // Every image ON the page, with its url, in one round trip.
    generator: 'images',
    gimlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    titles: title,
  })
  return `https://${host}/api.php?${q.toString()}`
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** Identifies us, as the wiki's API etiquette asks. */
export const WIKI_UA = 'DropMarketImportBot/1.0 (+https://dropmarket.gg)'

/**
 * Words that mark a file as something other than the item's own render.
 *
 *  · page furniture — banners, thumbnails, logos, event art
 *  · a VARIANT of the item (neon / mega / flurry): a different thing to sell,
 *    and using one as the base item's picture would misrepresent the listing
 */
const REJECT_TOKENS = [
  'gamepass', 'thumbnail', 'banner', 'logo', 'robux', 'icon', 'update', 'shop',
  'trading', 'event', 'halloween', 'christmas', 'concept', 'old', 'original',
  'neon', 'mega', 'flurry', 'egg',
]

/** Only still raster formats: a .gif is an animation, a .svg is page furniture. */
const ALLOWED_EXT = /\.(png|jpe?g|webp)$/i

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Choose the file that depicts the item, or null when none does.
 *
 * Scoring, highest first:
 *   3  "<name> Pet"      — the canonical render, the same convention Eldorado uses
 *   2  exactly "<name>"  — the plain render
 *   1  contains the name — anything else that at least depicts it
 * A file carrying a REJECT token, a non-still format, or not naming the item at
 * all scores nothing and is never returned.
 *
 * Pure, so the rules are testable against a real file list without the network.
 */
export function pickWikiImage(itemName: string, fileTitles: string[]): string | null {
  const wanted = squash(itemName)
  if (!wanted) return null

  let best: { title: string; score: number } | null = null

  for (const title of fileTitles) {
    if (!ALLOWED_EXT.test(title)) continue
    const bare = title.replace(/^File:/i, '').replace(ALLOWED_EXT, '')
    const key = squash(bare)
    if (!key.includes(wanted)) continue
    if (REJECT_TOKENS.some((t) => key.includes(t) && !wanted.includes(t))) continue

    const score = key === `${wanted}pet` ? 3 : key === wanted ? 2 : 1
    if (!best || score > best.score) best = { title, score }
  }

  return best?.title ?? null
}

interface ImagesResponse {
  query?: {
    pages?: Array<{ title?: string; imageinfo?: Array<{ url?: string }> }>
  }
}

/**
 * The best image on a wiki page for this item, or null.
 *
 * Never throws: a missing image falls through to the placeholder, and one
 * unreachable wiki must not fail a 500-row import.
 */
export async function fetchWikiImage(
  host: string,
  pageTitle: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!host || !pageTitle.trim()) return null
  try {
    const res = await fetchImpl(apiUrl(host, pageTitle), {
      headers: { 'user-agent': WIKI_UA, accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as ImagesResponse
    const pages = body.query?.pages ?? []
    if (pages.length === 0) return null

    const urlByTitle = new Map<string, string>()
    for (const p of pages) {
      const u = p.imageinfo?.[0]?.url
      if (p.title && typeof u === 'string') urlByTitle.set(p.title, u)
    }

    const picked = pickWikiImage(pageTitle, [...urlByTitle.keys()])
    if (!picked) return null
    const url = urlByTitle.get(picked)
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
  } catch {
    return null
  }
}
