/**
 * Phase 1 · Step 1e — game icon fetch / resize / upload.
 *
 * The single seam for filling public.games.image_url from an identifier
 * source. scripts/fill-game-icons.mjs is a thin caller, and Step 2's trend
 * radar calls fetchGameIcon() for a newly discovered game, so the matching
 * and encoding rules live here rather than inline in a script.
 *
 * Column note: the column is games.image_url — the same logo column the
 * admin wizard writes (uploadGameLogoV2). There is no games.icon_url; that
 * name exists only as a header in data/games-seed.csv.
 *
 * Storage note: uploads reuse the existing `category-icons` bucket under the
 * wizard's `games/` prefix, so an automated icon and an admin-uploaded one
 * are laid out identically and the wizard's replace path keeps working.
 *
 * Sources, all KEYLESS — this module takes no credentials:
 *   roblox    apis.roblox.com omni-search -> thumbnails (512x512 icon)
 *   appstore  itunes.apple.com search -> artworkUrl512 (square app icon)
 *   steam     store storesearch -> appid -> CDN library_600x900 (letterboxed)
 *
 * Roblox games use the Roblox source; everything else tries App Store first
 * (a real square icon) and falls back to Steam (box art). Wikidata P154 was
 * evaluated as a third fallback and rejected — see NON_ROBLOX_ADAPTERS.
 *
 * The pure parts (title normalisation, candidate scoring, refresh policy)
 * are exported separately and unit-tested; the IO parts take injectable
 * fetch/storage so a test never needs the network.
 */

// ── types ──────────────────────────────────────────────────────────────────

export type IconSource = 'roblox' | 'appstore' | 'steam' | 'wikidata' | 'manual'

/** The automated sources. `manual` is never produced by a fetch. */
export const AUTOMATED_SOURCES: readonly IconSource[] = [
  'roblox',
  'appstore',
  'steam',
  'wikidata',
] as const

export interface GameForIcon {
  slug: string
  name: string
  ecosystem?: string | null
  image_url?: string | null
  image_source?: string | null
  image_synced_at?: string | null
  /**
   * Known platform id (Roblox universeId). When set, the name search and
   * its ambiguity rule are skipped: the caller already knows WHICH game.
   * The trend radar discovers games by universeId, and Roblox has
   * duplicate-title universes (Steal An Egg) that a name search must refuse.
   */
  externalId?: string | number | null
}

export interface IconCandidate {
  /** Title as the upstream source spells it. */
  title: string
  /** Opaque id used to fetch the image (universeId, App Store trackId, Steam appid). */
  id: string | number
  /** Direct image URL when the source hands one over (App Store, Steam). */
  imageUrl?: string
}

export type IconStatus =
  | 'filled'
  | 'skipped-has-icon'
  | 'skipped-fresh'
  | 'unmatched'
  | 'ambiguous'
  | 'error'

export interface IconResult {
  slug: string
  status: IconStatus
  source?: IconSource
  matchedTitle?: string
  confidence?: number
  iconUrl?: string
  /** Populated for `ambiguous` so the report can list what it saw. */
  candidates?: IconCandidate[]
  error?: string
}

// ── pure: title matching ───────────────────────────────────────────────────

/**
 * Normalise a title for comparison: casefold, strip punctuation and the
 * decorative junk Roblox creators put in game names (emoji, [UPDATE!],
 * 🔥NEW🔥), collapse whitespace.
 *
 * "🔥 Steal a Brainrot [UPDATE]" and "Steal A Brainrot!" both normalise to
 * "steal a brainrot".
 */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')        // [UPDATE!], [NEW]
    .replace(/\([^)]*\)/g, ' ')          // (Beta)
    // Apostrophes ELIDE rather than split, so a possessive matches whether
    // or not the upstream title punctuates it: "Sol's RNG" and "Sols RNG"
    // both become "sols rng". Splitting them produced a 0.28 score for two
    // titles that are plainly the same game.
    .replace(/['\u2018\u2019\u02bc]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')    // punctuation + emoji -> space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens that carry no identity — ignored when comparing titles. */
const NOISE_TOKENS = new Set([
  'the', 'a', 'an', 'roblox', 'official', 'update', 'new', 'beta',
  'remastered', 'definitive', 'edition', 'online', 'game',
  // Roblox genre suffixes creators append to an otherwise identical title:
  // "Greenville RP" is the game listed as "Greenville".
  'rp', 'roleplay',
])

function contentTokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t && !NOISE_TOKENS.has(t))
}

/**
 * Confidence that `candidate` is the same game as `wanted`, in [0, 1].
 *
 *   1.00  normalised titles identical
 *   0.90  identical once noise tokens are dropped
 *   <0.9  Jaccard overlap of content tokens
 *
 * Deliberately conservative: a wrong icon on a game page is worse than a
 * blank one the owner fills in by hand.
 */
export function scoreCandidate(wanted: string, candidate: string): number {
  const a = normalizeTitle(wanted)
  const b = normalizeTitle(candidate)
  if (!a || !b) return 0
  if (a === b) return 1

  const ta = contentTokens(a)
  const tb = contentTokens(b)
  if (ta.length === 0 || tb.length === 0) return 0
  if (ta.join(' ') === tb.join(' ')) return 0.9

  // A candidate that opens with the ENTIRE wanted title and then adds a
  // tagline is the same game with marketing attached: "Creatures of Sonaria
  // Survive Kaiju Animals".
  //
  // Three guards keep this from swallowing a different game:
  //  - the wanted title must be at least two tokens, so a one-word name does
  //    not match every title that begins with it;
  //  - the extra tokens must not contain a NUMBER, because a trailing digit
  //    is how sequels and knock-offs are named ("Steal a Brainrot 2 Tycoon");
  //  - the tagline must be short relative to the title, so a name appearing
  //    inside a much longer unrelated title does not win.
  if (ta.length >= 2 && tb.length > ta.length && ta.every((t, i) => tb[i] === t)) {
    const extra = tb.slice(ta.length)
    const hasNumber = extra.some((t) => /\d/.test(t))
    if (!hasNumber && extra.length <= ta.length + 1) return 0.9
  }

  const sa = new Set(ta)
  const sb = new Set(tb)
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared += 1
  const union = new Set([...sa, ...sb]).size
  return union === 0 ? 0 : (shared / union) * 0.85
}

/** At or above this a match is accepted. */
export const ACCEPT_THRESHOLD = 0.9
/** Two candidates within this of each other are "too close to call". */
export const AMBIGUITY_MARGIN = 0.05

export interface MatchDecision {
  status: 'matched' | 'ambiguous' | 'unmatched'
  best?: IconCandidate
  confidence: number
  candidates?: IconCandidate[]
}

/**
 * Pick a candidate, or refuse to. Refusing is a first-class outcome: an
 * ambiguous game is reported with its candidates for the owner to resolve
 * in the admin panel, never guessed at.
 */
export function decideMatch(wanted: string, candidates: IconCandidate[]): MatchDecision {
  if (candidates.length === 0) return { status: 'unmatched', confidence: 0 }

  const scored = candidates
    .map((c) => ({ candidate: c, score: scoreCandidate(wanted, c.title) }))
    .sort((x, y) => y.score - x.score)

  const top = scored[0]
  if (top.score < ACCEPT_THRESHOLD) {
    return { status: 'unmatched', confidence: top.score, candidates: candidates.slice(0, 3) }
  }

  const runnerUp = scored[1]
  // Two candidates both clear the bar and sit within a hair of each other:
  // an exact-title duplicate (common on Roblox) that we must not guess at.
  if (
    runnerUp &&
    runnerUp.score >= ACCEPT_THRESHOLD &&
    top.score - runnerUp.score <= AMBIGUITY_MARGIN
  ) {
    return {
      status: 'ambiguous',
      confidence: top.score,
      candidates: scored.slice(0, 3).map((s) => s.candidate),
    }
  }

  return { status: 'matched', best: top.candidate, confidence: top.score }
}

// ── pure: refresh policy ───────────────────────────────────────────────────

export const REFRESH_AFTER_DAYS = 30

export interface FillPolicyOptions {
  /** Re-fetch automated icons older than REFRESH_AFTER_DAYS. */
  refresh?: boolean
  /** Slug the caller explicitly asked to overwrite. */
  forceSlug?: string | null
  now?: Date
}

export type FillDecision =
  | { fill: true; reason: 'empty' | 'forced' | 'stale' }
  | { fill: false; reason: 'has-icon' | 'fresh' | 'manual' }

/**
 * Whether to fetch an icon for this game.
 *
 * Fill-only is the default: a game that already has an icon is left alone.
 * --refresh relaxes that for automated icons past the cutoff, but NEVER for
 * a manual one — an admin upload outranks anything a script would fetch.
 * --force <slug> overrides everything, one game at a time.
 */
export function decideFill(game: GameForIcon, opts: FillPolicyOptions = {}): FillDecision {
  const { refresh = false, forceSlug = null, now = new Date() } = opts

  if (forceSlug && game.slug === forceSlug) return { fill: true, reason: 'forced' }

  const hasIcon = typeof game.image_url === 'string' && game.image_url.trim() !== ''
  if (!hasIcon) return { fill: true, reason: 'empty' }

  if (!refresh) return { fill: false, reason: 'has-icon' }

  // An admin-uploaded icon is protected from --refresh. So is anything
  // whose provenance we don't know: absent image_source means it predates
  // the filler, which makes it human-made until proven otherwise.
  const source = game.image_source
  if (!source || !AUTOMATED_SOURCES.includes(source as IconSource)) {
    return { fill: false, reason: 'manual' }
  }

  if (!game.image_synced_at) return { fill: true, reason: 'stale' }
  const synced = new Date(game.image_synced_at).getTime()
  if (Number.isNaN(synced)) return { fill: true, reason: 'stale' }

  const ageDays = (now.getTime() - synced) / 86_400_000
  return ageDays >= REFRESH_AFTER_DAYS
    ? { fill: true, reason: 'stale' }
    : { fill: false, reason: 'fresh' }
}

// ── pure: storage paths ────────────────────────────────────────────────────

/** Rendered sizes. The 512 master becomes games.image_url. */
export const ICON_SIZES = [512, 128, 64] as const
export type IconSize = (typeof ICON_SIZES)[number]

/**
 * Cache-control for content-hashed objects: the name changes when the bytes
 * do, so a year of immutable caching is safe.
 *
 * Value is the seconds only, NOT a full header string. supabase-js builds
 * the header as `max-age=${cacheControl}`, so passing
 * 'public, max-age=31536000, immutable' yields the malformed
 * 'max-age=public, max-age=31536000, immutable'. Verified against a real
 * upload on the local stack.
 */
export const IMMUTABLE_CACHE_SECONDS = '31536000'

/** The header supabase-js produces from IMMUTABLE_CACHE_SECONDS. */
export const IMMUTABLE_CACHE_CONTROL = `max-age=${IMMUTABLE_CACHE_SECONDS}`

/** The bucket the admin wizard already writes game logos into. */
export const ICON_BUCKET = 'category-icons'

/**
 * Object path for one variant. Mirrors the wizard's `games/` prefix, with a
 * content hash so a re-fetch that yields identical bytes reuses the same
 * URL and a changed icon busts caches by name rather than by header.
 */
export function iconObjectPath(slug: string, hash: string, size: IconSize): string {
  return `games/${slug}-${hash.slice(0, 12)}-${size}.webp`
}

// ── IO: shared fetch helpers ───────────────────────────────────────────────

/** Injectable so tests never touch the network. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * GET with backoff on 429/5xx. Honours Retry-After when the server sends
 * one — Roblox does under load, and ignoring it just earns a longer ban.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  fetchImpl: FetchLike = fetch,
  opts: RetryOptions = {},
): Promise<Response> {
  const { attempts = 4, baseDelayMs = 700, sleep = defaultSleep } = opts
  let lastErr: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetchImpl(url, init)
      if (res.status !== 429 && res.status < 500) return res
      if (attempt === attempts - 1) return res

      const retryAfter = Number(res.headers?.get?.('retry-after') ?? '')
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt
      await sleep(waitMs)
    } catch (e) {
      lastErr = e
      if (attempt === attempts - 1) throw e
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastErr ?? new Error(`fetch failed: ${url}`)
}

// ── IO: Roblox ─────────────────────────────────────────────────────────────

const ROBLOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

/** Identifies this bot to the keyless third-party APIs, as they ask. */
export const ICON_BOT_UA = 'DropMarketIconBot/1.0 (+https://dropmarket.gg)'

/**
 * Search Roblox for a game by name.
 *
 * Uses apis.roblox.com omni-search, which returns universeId directly. The
 * older games.roblox.com/v1/games/list documented for this step is dead —
 * it answers {"errors":[{"code":0}]} — and omni-search also saves the
 * place-id -> universe-id hop, so no place ids are needed at all.
 */
export async function searchRobloxGames(
  name: string,
  fetchImpl: FetchLike = fetch,
  opts: RetryOptions = {},
): Promise<IconCandidate[]> {
  const url =
    'https://apis.roblox.com/search-api/omni-search' +
    `?searchQuery=${encodeURIComponent(name)}&pageToken=&sessionId=dropmarket-icons&pageType=all`

  const res = await fetchWithBackoff(url, { headers: { 'User-Agent': ROBLOX_UA } }, fetchImpl, opts)
  if (!res.ok) throw new Error(`roblox omni-search ${res.status}`)

  const body = (await res.json()) as {
    searchResults?: { contentGroupType?: string; contents?: { universeId?: number; name?: string }[] }[]
  }

  const out: IconCandidate[] = []
  for (const group of body.searchResults ?? []) {
    if (group.contentGroupType !== 'Game') continue
    for (const c of group.contents ?? []) {
      if (typeof c.universeId === 'number' && typeof c.name === 'string') {
        out.push({ title: c.name, id: c.universeId })
      }
    }
  }
  return out
}

/** Resolve a universe id to its 512×512 icon URL. */
export async function robloxIconUrl(
  universeId: string | number,
  fetchImpl: FetchLike = fetch,
  opts: RetryOptions = {},
): Promise<string | null> {
  const url =
    'https://thumbnails.roblox.com/v1/games/icons' +
    `?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`

  const res = await fetchWithBackoff(url, {}, fetchImpl, opts)
  if (!res.ok) throw new Error(`roblox thumbnails ${res.status}`)

  const body = (await res.json()) as {
    data?: { state?: string; imageUrl?: string }[]
  }
  const hit = body.data?.[0]
  if (!hit || hit.state !== 'Completed' || !hit.imageUrl) return null
  return hit.imageUrl
}

// ── IO: Apple App Store ────────────────────────────────────────────────────

/**
 * Search the iTunes/App Store search API for a game by name.
 *
 * Keyless and unmetered (Apple asks for ~20 calls/min, which the caller's
 * pacing respects). `artworkUrl512` is a square 512x512 app icon — already
 * exactly the shape and size we want, with no cropping.
 *
 * This is the FIRST non-Roblox source because an app icon is a real icon,
 * where a Steam cover is box art that has to be squared.
 *
 * Note the matcher does the real work here: for a game with no iOS release
 * (Valorant, Team Fortress 2) this returns only companion/fan apps, and
 * decideMatch refuses them. Verified live.
 */
export async function searchAppStoreGames(
  name: string,
  fetchImpl: FetchLike = fetch,
  opts: RetryOptions = {},
): Promise<IconCandidate[]> {
  const url =
    'https://itunes.apple.com/search' +
    `?term=${encodeURIComponent(name)}&entity=software&limit=8&country=US`

  const res = await fetchWithBackoff(url, { headers: { 'User-Agent': ICON_BOT_UA } }, fetchImpl, opts)
  if (!res.ok) throw new Error(`appstore search ${res.status}`)

  const body = (await res.json()) as {
    results?: { trackName?: string; trackId?: number; artworkUrl512?: string; artworkUrl100?: string }[]
  }

  return (body.results ?? [])
    .filter((r) => typeof r.trackName === 'string' && (r.artworkUrl512 || r.artworkUrl100))
    .map((r) => ({
      title: r.trackName as string,
      id: r.trackId ?? 0,
      imageUrl: (r.artworkUrl512 ?? r.artworkUrl100) as string,
    }))
}

// ── IO: Steam ──────────────────────────────────────────────────────────────

/**
 * Resolve Steam candidates by name.
 *
 * NOTE: the documented `ISteamApps/GetAppList` endpoint is GONE — Steam
 * answers `Method 'GetAppList' not found in interface 'ISteamApps'` (404).
 * The store's own search endpoint is keyless, returns appids with exact
 * titles, and is what the store front-end uses. Verified live.
 */
export async function searchSteamGames(
  name: string,
  fetchImpl: FetchLike = fetch,
  opts: RetryOptions = {},
): Promise<IconCandidate[]> {
  const url =
    'https://store.steampowered.com/api/storesearch/' +
    `?term=${encodeURIComponent(name)}&l=en&cc=US`

  const res = await fetchWithBackoff(url, { headers: { 'User-Agent': ICON_BOT_UA } }, fetchImpl, opts)
  if (!res.ok) throw new Error(`steam search ${res.status}`)

  const body = (await res.json()) as { items?: { id?: number; name?: string }[] }

  return (body.items ?? [])
    .filter((i) => typeof i.name === 'string' && typeof i.id === 'number')
    .map((i) => ({
      title: i.name as string,
      id: i.id as number,
      imageUrl: steamImageUrl(i.id as number),
    }))
}

/**
 * Steam CDN artwork for an appid. `library_600x900` is the portrait library
 * cover; it exists for essentially every store page and is the highest
 * quality art Steam serves without a key.
 */
export function steamImageUrl(appId: string | number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`
}

/** Fallback when an app has no library cover. */
export function steamHeaderUrl(appId: string | number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
}

// ── IO: encode ─────────────────────────────────────────────────────────────

export interface EncodedIcon {
  size: IconSize
  bytes: Buffer
}

/** Max bytes for the 512 master, per the step spec. */
export const MAX_MASTER_BYTES = 60 * 1024

/**
 * Re-encode source bytes into 512/128/64 WebP.
 *
 * Squares by `contain` on a transparent canvas, so a portrait Steam cover is
 * letterboxed rather than cropped through the title. Quality steps down
 * until the 512 master fits MAX_MASTER_BYTES.
 *
 * `sharp` is imported dynamically: this module is imported by the Next.js
 * app for its pure helpers, and only the script path needs the native lib.
 */
export async function encodeIconVariants(source: Buffer): Promise<EncodedIcon[]> {
  const { default: sharp } = await import('sharp')

  const out: EncodedIcon[] = []
  for (const size of ICON_SIZES) {
    let bytes: Buffer | null = null
    // Quality ladder for the 512 master. The last rung must be low enough
    // that a busy, high-entropy icon still lands under MAX_MASTER_BYTES —
    // a real Roblox icon came out at 60,510 bytes when the ladder stopped
    // at 45, which is over budget. Smaller sizes break after the first pass.
    for (const quality of [82, 70, 58, 45, 34, 25]) {
      const candidate = await sharp(source)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality, effort: 5 })
        .toBuffer()
      bytes = candidate
      if (size !== 512 || candidate.length <= MAX_MASTER_BYTES) break
    }
    if (bytes) out.push({ size, bytes })
  }
  return out
}

// ── IO: upload ─────────────────────────────────────────────────────────────

/** The slice of the Supabase storage client this module needs. */
export interface StorageLike {
  from(bucket: string): {
    upload(
      path: string,
      body: Buffer,
      opts?: { contentType?: string; cacheControl?: string; upsert?: boolean },
    ): Promise<{ error: { message: string } | null }>
    getPublicUrl(path: string): { data: { publicUrl: string } }
  }
}

export interface UploadedIcon {
  /** Public URL of the 512 master — what games.image_url becomes. */
  masterUrl: string
  paths: string[]
  bytes: number
}

/**
 * Upload every variant under a content-hashed name with an immutable
 * cache header. Same bytes -> same path, so a re-fetch is a no-op upsert
 * rather than a new object.
 */
export async function uploadIconVariants(
  storage: StorageLike,
  slug: string,
  hash: string,
  variants: EncodedIcon[],
): Promise<UploadedIcon> {
  const bucket = storage.from(ICON_BUCKET)
  const paths: string[] = []
  let masterUrl = ''
  let bytes = 0

  for (const v of variants) {
    const path = iconObjectPath(slug, hash, v.size)
    const { error } = await bucket.upload(path, v.bytes, {
      contentType: 'image/webp',
      cacheControl: IMMUTABLE_CACHE_SECONDS,
      upsert: true,
    })
    if (error) throw new Error(`upload ${path}: ${error.message}`)

    paths.push(path)
    bytes += v.bytes.length
    if (v.size === 512) masterUrl = bucket.getPublicUrl(path).data.publicUrl
  }

  if (!masterUrl) throw new Error(`no 512 master produced for ${slug}`)
  return { masterUrl, paths, bytes }
}

// ── the seam ───────────────────────────────────────────────────────────────

export interface FetchGameIconDeps {
  storage: StorageLike
  fetchImpl?: FetchLike
  retry?: RetryOptions
  /** Hash bytes -> hex. Injectable to keep this module import-light. */
  hashBytes?: (b: Buffer) => string | Promise<string>
}

/**
 * One identifier source: how to find candidates, and how to turn the winning
 * candidate into an image URL.
 */
interface SourceAdapter {
  source: IconSource
  search: (name: string, f: FetchLike, o: RetryOptions) => Promise<IconCandidate[]>
  /** Extra URLs to try if the candidate's own imageUrl 404s. */
  fallbackUrls?: (c: IconCandidate) => string[]
}

const ROBLOX_ADAPTER: SourceAdapter = {
  source: 'roblox',
  search: searchRobloxGames,
}

/**
 * Non-Roblox sources, in priority order.
 *
 *  1. App Store — `artworkUrl512` is a real square app icon, no cropping.
 *  2. Steam — portrait box art, letterboxed to square (see encodeIconVariants).
 *
 * Wikidata (P154) was specified as a third fallback and is deliberately NOT
 * here: it was tested live and rejected. Its logos are wordmarks with extreme
 * aspect ratios (Warframe 1024x404, Team Fortress 2 3822x820) that become an
 * illegible sliver in a 64px square, on a transparent/white background that
 * reads as broken on the dark UI — and P154 covered only 4 of 8 sampled
 * games. Two-letter initials are a better icon than that. `wikidata` remains
 * in the image_source CHECK so the path can be added without a migration.
 */
const NON_ROBLOX_ADAPTERS: SourceAdapter[] = [
  { source: 'appstore', search: searchAppStoreGames },
  {
    source: 'steam',
    search: searchSteamGames,
    fallbackUrls: (c) => [steamHeaderUrl(c.id)],
  },
]

async function defaultHash(b: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(b).digest('hex')
}

/**
 * Fetch, encode and upload one game's icon, returning what happened.
 *
 * This is the seam Step 2's trend radar calls for a newly discovered game:
 * give it a game row and a storage client and it returns an IconResult
 * whose iconUrl is ready to write to games.image_url, or a non-fatal status
 * explaining why nothing was written.
 *
 * It does NOT write to the database — the caller owns that, so a dry run is
 * simply "call this and don't persist".
 */
export async function fetchGameIcon(
  game: GameForIcon,
  deps: FetchGameIconDeps,
): Promise<IconResult> {
  const { storage, fetchImpl = fetch, retry = {} } = deps
  const hash = deps.hashBytes ?? defaultHash

  const isRoblox = (game.ecosystem ?? '').toLowerCase() === 'roblox'
  const adapters = isRoblox ? [ROBLOX_ADAPTER] : NON_ROBLOX_ADAPTERS

  // Remembered across adapters so a refusal is reported with the reason and
  // candidates of the source that came CLOSEST, not of the last one tried.
  let best: IconResult | null = null
  const rank = (r: IconResult) => (r.status === 'ambiguous' ? 2 : r.status === 'unmatched' ? 1 : 0)
  const remember = (r: IconResult) => {
    if (!best || rank(r) > rank(best) || (r.confidence ?? 0) > (best.confidence ?? 0)) best = r
  }

  for (const adapter of adapters) {
    try {
      const known =
        adapter.source === 'roblox' && game.externalId !== undefined && game.externalId !== null && game.externalId !== ''
      const decision: MatchDecision = known
        ? { status: 'matched', best: { title: game.name, id: game.externalId as string | number }, confidence: 1 }
        : decideMatch(game.name, await adapter.search(game.name, fetchImpl, retry))

      if (decision.status === 'ambiguous') {
        // Ambiguity is a REFUSAL, not a miss: two plausible games means we
        // must not guess. Do not fall through to a lower-priority source,
        // or a confident wrong match would beat an honest refusal.
        return {
          slug: game.slug,
          status: 'ambiguous',
          source: adapter.source,
          confidence: decision.confidence,
          candidates: decision.candidates,
        }
      }

      if (decision.status !== 'matched' || !decision.best) {
        remember({
          slug: game.slug,
          status: 'unmatched',
          source: adapter.source,
          confidence: decision.confidence,
          candidates: decision.candidates,
        })
        continue
      }

      // Resolve the image URL, trying the adapter's fallbacks on a 404.
      const cand = decision.best
      const urls = [
        adapter.source === 'roblox'
          ? await robloxIconUrl(cand.id, fetchImpl, retry)
          : (cand.imageUrl ?? null),
        ...(adapter.fallbackUrls?.(cand) ?? []),
      ].filter((u): u is string => typeof u === 'string' && u.length > 0)

      let original: Buffer | null = null
      for (const url of urls) {
        const r = await fetchWithBackoff(url, { headers: { 'User-Agent': ICON_BOT_UA } }, fetchImpl, retry)
        if (r.ok) {
          original = Buffer.from(await r.arrayBuffer())
          break
        }
      }

      if (!original) {
        remember({
          slug: game.slug,
          status: 'unmatched',
          source: adapter.source,
          matchedTitle: cand.title,
          confidence: decision.confidence,
          error: 'matched, but no icon image could be downloaded',
        })
        continue
      }

      const variants = await encodeIconVariants(original)
      const digest = await hash(variants.find((v) => v.size === 512)!.bytes)
      const uploaded = await uploadIconVariants(storage, game.slug, digest, variants)

      return {
        slug: game.slug,
        status: 'filled',
        source: adapter.source,
        matchedTitle: cand.title,
        confidence: decision.confidence,
        iconUrl: uploaded.masterUrl,
      }
    } catch (e) {
      // One source being down must not sink the others.
      remember({
        slug: game.slug,
        status: 'error',
        source: adapter.source,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return best ?? { slug: game.slug, status: 'unmatched', confidence: 0 }
}
