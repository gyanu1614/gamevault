#!/usr/bin/env node
/**
 * measure-seed — a small, deterministic fixture for LOCAL page-weight work.
 *
 *   node --experimental-strip-types --no-warnings scripts/measure-seed.mjs            # seed (idempotent) + verify
 *   node --experimental-strip-types --no-warnings scripts/measure-seed.mjs --verify   # anon-key reads only
 *   node --experimental-strip-types --no-warnings scripts/measure-seed.mjs --clean    # remove everything it made
 *   ... --sab-items=504                                                              # scale the SAB catalogue (default 60)
 *
 * What it builds, so the five measured routes render real data:
 *   /                              12 sellers, 58 active listings over 11 games (latest-listings rail, popular games)
 *   /valorant                      Valorant gets its currency + items pairs (accounts already seeded) and
 *                                  14 / 12 / 12 listings, so the hub's two offer rails and currency card are full
 *   /valorant/buy-vp               14 VP offers at varied prices + a curated currency config (FAQ, steps)
 *   /steal-a-brainrot/values       N brainrots (default 60) x 14 mutations, prices, popularity, 7-day movers
 *   /steal-a-brainrot/values/<slug> priced items with sample_size >= 3; the top 8 carry 30 days of price history
 *   plus 4 blog posts each for Valorant and Steal a Brainrot (BlogRail / HubGuidesStrip) and synthetic PNG art
 *   uploaded to this stack's own storage (no external image host is ever referenced).
 *
 * SAFETY (hard rules, enforced in code):
 *   - reads ONLY <repo>/.env.test (never .env.local, never process.env credentials);
 *   - refuses to run unless the Supabase URL host is 127.0.0.1 or localhost;
 *   - every request goes through a fetch wrapper that throws on any other host;
 *   - writes ONLY through REST with the local service-role key; no SQL, no db reset.
 *
 * IDEMPOTENT: stable emails (measure-seed-N@example.test), deterministic ids, upserts / insert-if-missing.
 * Running twice changes nothing. --clean removes exactly what this script created (markers below) and nothing else.
 *
 * Markers used for --clean:
 *   auth users / profiles   email like measure-seed-%@example.test      (profiles, presence, listings cascade)
 *   sab_brainrots           source_name = 'measure-seed'                (price history/snapshots cascade)
 *   sab_price_display       brainrot_id of those brainrots
 *   sab_mutations           source_url = 'measure-seed://mutations'     (only the rows this script created)
 *   sab_mutation_price_multipliers  pair_count = 0                      (real rows always have pair_count > 0)
 *   game_categories         extras.measure_seed = true                  (only pairs this script created)
 *   blog_posts              the fixed slugs below
 *   storage                 measure-seed/ prefix in listing-images, profile-pictures, blog-images
 *
 * Caveat: `sab_refresh_price_display()` rebuilds sab_price_display from the evidence tables, so running the SAB
 * pipeline against this stack would drop the seeded price rows. Re-run this script afterwards.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse as parseEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (f) => argv.includes(f)
const opt = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const CLEAN = flag('--clean')
const VERIFY_ONLY = flag('--verify')
const SAB_ITEMS = Math.max(10, Math.min(600, Number(opt('sab-items', '60')) || 60))
const ENV_NAME = opt('env', 'test')

function die(msg) {
  console.error(`\n  x measure-seed: ${msg}\n`)
  process.exit(1)
}

// ── env: .env.test ONLY, local host ONLY ───────────────────────────────────
if (ENV_NAME !== 'test') die(`--env=${ENV_NAME} is not allowed. This script only ever reads .env.test (use --env=test or omit it).`)
const ENV_FILE = path.join(REPO_ROOT, '.env.test')
if (!existsSync(ENV_FILE)) die(`${ENV_FILE} not found. Run \`pnpm db:up\` in this worktree first.`)
// parse() reads the file only; it never writes to process.env, so a stray exported
// NEXT_PUBLIC_SUPABASE_URL in the shell can never redirect this script.
const env = parseEnv(readFileSync(ENV_FILE))
const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SERVICE_KEY = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const ANON_KEY = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) die('.env.test is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.')

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
let parsedUrl
try {
  parsedUrl = new URL(SUPABASE_URL)
} catch {
  die(`NEXT_PUBLIC_SUPABASE_URL in .env.test is not a valid URL.`)
}
if (!LOCAL_HOSTS.has(parsedUrl.hostname)) {
  die(`REFUSING to run: the Supabase host in .env.test is "${parsedUrl.hostname}", not 127.0.0.1 / localhost. This script only seeds a local stack.`)
}
const BASE = `${parsedUrl.protocol}//${parsedUrl.host}`

/** Second line of defence: no request may leave the local host, whatever the SDK does. */
const guardedFetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const host = new URL(raw).hostname
  if (!LOCAL_HOSTS.has(host)) throw new Error(`measure-seed blocked a request to non-local host "${host}"`)
  return fetch(input, init)
}
const clientOpts = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guardedFetch } }
const svc = createClient(BASE, SERVICE_KEY, clientOpts)
const anon = createClient(BASE, ANON_KEY, clientOpts)

// ── helpers ────────────────────────────────────────────────────────────────
const must = (res, label) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  return res.data
}
const chunks = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
const slugify = (s) =>
  s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const uuid = (name) => {
  const h = createHash('sha1').update(`measure-seed:${name}`).digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}
/** Deterministic PRNG (mulberry32). */
const prng = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const NOW = Date.now()
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString()
const dayStr = (daysAgo) => new Date(NOW - daysAgo * 86400_000).toISOString().slice(0, 10)

const SELLER_EMAIL = (n) => `measure-seed-${n}@example.test`
const SELLER_EMAIL_LIKE = 'measure-seed-%@example.test'
const SAB_MARK = 'measure-seed'
const MUT_MARK = 'measure-seed://mutations'
const BUCKETS = ['listing-images', 'profile-pictures', 'blog-images']
const publicUrl = (bucket, p) => `${BASE}/storage/v1/object/public/${bucket}/${p}`

// ── synthetic PNG art (no dependencies, no external hosts) ─────────────────
const CRC_T = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b) => {
  let c = 0xffffffff
  for (const x of b) c = CRC_T[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const pngChunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, c])
}
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255))
}
/** A smooth, quantised radial gradient: realistic-ish weight (~20-45 KB), fully deterministic. */
function artPng(seed, w, h) {
  const hue = (seed * 57) % 360
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1)
    for (let x = 0; x < w; x++) {
      const dx = (x - w * 0.5) / w
      const dy = (y - h * 0.5) / h
      const d = Math.sqrt(dx * dx + dy * dy)
      const l = 0.18 + 0.32 * Math.max(0, 1 - d * 1.8) + 0.04 * Math.sin((x + y) / 23)
      const rgb = hsl((hue + d * 90) % 360, 0.6, l)
      for (let c = 0; c < 3; c++) raw[o + 1 + x * 3 + c] = Math.min(255, Math.round(rgb[c] / 6) * 6)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── fixture data ───────────────────────────────────────────────────────────
const SELLERS = [
  ['VaultRunner', 'vaultrunner'], ['Apex Armory', 'apex-armory'], ['PixelForge', 'pixelforge'],
  ['GG Locker', 'gg-locker'], ['Nova Trades', 'nova-trades'], ['Orbit Market', 'orbit-market'],
  ['Crimson Keys', 'crimson-keys'], ['Ember Exchange', 'ember-exchange'], ['Lumen Loot', 'lumen-loot'],
  ['Quickdrop Hub', 'quickdrop-hub'], ['Titan Supply', 'titan-supply'], ['Zen Gear', 'zen-gear'],
]
const TIER_SALES = [14, 61, 148, 322, 780, 1530]

const BLOG_POSTS = [
  ['valorant', 'how-to-buy-valorant-points-safely', 'How To Buy Valorant Points Safely', 'guide', 5, 'A plain walkthrough of buying VP from a verified seller: what to check, how delivery works and what happens if something goes wrong.'],
  ['valorant', 'best-valorant-skins-worth-buying', 'The Valorant Skins Worth Buying In 2026', 'guide', 7, 'Which skin lines hold their price, which ones are overhyped, and how to compare offers from different sellers before you pay.'],
  ['valorant', 'valorant-account-buying-guide', 'Valorant Account Buying Guide: Ranks, Regions And Risks', 'guide', 8, 'What a fair price looks like for each rank, why region matters, and the checks that keep a bought account yours.'],
  ['valorant', 'how-much-is-my-valorant-account-worth', 'How Much Is My Valorant Account Worth?', 'value', 6, 'A quick way to price your account from rank, skins and agents, using what comparable accounts actually sell for.'],
  ['steal-a-brainrot', 'how-brainrot-values-are-calculated', 'How Brainrot Values Are Calculated', 'value', 6, 'Our values come from live listings by reputable sellers, not community guesses. Here is exactly how the numbers are built.'],
  ['steal-a-brainrot', 'how-to-sell-brainrots-for-real-money', 'How To Sell Brainrots For Real Money', 'seller', 5, 'List a Secret or Mythic Brainrot, price it against the market and get paid once the buyer confirms delivery.'],
  ['steal-a-brainrot', 'best-mutations-by-value', 'Best Mutations By Value In Steal A Brainrot', 'value', 7, 'Gold, Diamond, Rainbow and the rest ranked by the premium buyers really pay over the default version.'],
  ['steal-a-brainrot', 'trading-brainrots-safely-scams-to-avoid', 'Trading Brainrots Safely: Scams To Avoid', 'guide', 6, 'The common tricks in Brainrot trades and how buying through a protected order removes most of the risk.'],
]

const VP_PRICES = [0.0071, 0.0073, 0.0074, 0.0076, 0.0078, 0.0079, 0.0081, 0.0083, 0.0085, 0.0087, 0.0089, 0.0092, 0.0095, 0.0098]
const VP_STOCK = [250000, 80000, 120000, 45000, 300000, 20000, 150000, 60000, 90000, 35000, 200000, 15000, 70000, 25000]
const VP_MIN = [100, 475, 100, 1000, 100, 500, 100, 1000, 100, 475, 100, 100, 1000, 100]
const VP_DELIVERY = ['instant', '5min', '15min', 'instant', '30min', '1hr', '10min', 'instant', '20min', '2hr', '5min', '15min', 'instant', '30min']
const VP_REGION = ['NA', 'EU', 'APAC', 'LATAM']
const VP_ADJ = ['Cheap', 'Fast', 'Safe', 'Bulk', 'Verified']

const VAL_SKINS = [
  ['Reaver Vandal', 'Premium', 38], ['Prime Vandal', 'Premium', 24], ['Elderflame Operator', 'Ultra', 79],
  ['Glitchpop Dagger', 'Premium', 55], ['Sovereign Ghost', 'Deluxe', 18], ['Oni Phantom', 'Premium', 29],
  ['Ion Sheriff', 'Select', 9], ['Spectrum Phantom', 'Exclusive', 64], ['Singularity Melee', 'Premium', 31],
  ['Champions 2024 Vandal', 'Exclusive', 95], ['Gaias Vengeance Vandal', 'Premium', 27], ['Ruination Sheriff', 'Deluxe', 14],
]
const VAL_RANKS = [
  ['Iron 3', 14], ['Bronze 2', 22], ['Silver 3', 31], ['Gold 1', 46], ['Gold 3', 58], ['Platinum 2', 79],
  ['Diamond 1', 112], ['Diamond 3', 148], ['Ascendant 2', 205], ['Immortal 1', 290], ['Immortal 3', 365], ['Radiant', 420],
]

/** Other games: 2 listings each, drawn from the categories the game really has. */
const OTHER_GAMES = [
  ['adopt-me', [['buy-items', 'Shadow Dragon - Fly Ride Ready', 'items', 42], ['buy-accounts', 'Adopt Me Account - 120 Pets, Legendary Inventory', 'account', 85]]],
  ['apex-legends', [['buy-accounts', 'Apex Predator Account - Season 22 Badge', 'account', 160], ['buy-accounts', 'Master Rank Apex Account - Heirloom Unlocked', 'account', 235]]],
  ['blade-ball', [['buy-currency', 'Blade Ball Tokens - Fast Delivery', 'currency', 0.0021], ['buy-items', 'Blade Ball Rare Sword Crate Bundle', 'items', 6.5]]],
  ['cs2', [['buy-items', 'AK-47 Redline Field-Tested', 'items', 21.5], ['buy-accounts', 'CS2 Prime Account - Global Elite', 'account', 140]]],
  ['fortnite', [['buy-accounts', 'Fortnite OG Account - Renegade Raider', 'account', 520], ['buy-accounts', 'Fortnite Account - 90 Skins, Full Access', 'account', 75]]],
  ['grow-a-garden-2', [['buy-currency', 'Grow a Garden Sheckles - Bulk Stock', 'currency', 0.0009], ['buy-items', 'Rare Seeds Pack - Mutation Ready', 'items', 8.9]]],
  ['gta-vi', [['buy-accounts', 'GTA Online Modded Account - Max Rank', 'account', 48], ['buy-accounts', 'GTA Account - Billionaire Starter', 'account', 29]]],
  ['r6-siege', [['buy-accounts', 'Rainbow Six Siege Account - Champion Rank', 'account', 95], ['buy-accounts', 'R6 Siege Unranked Account - Elite Skins', 'account', 38]]],
  ['roblox', [['buy-items', 'Roblox Limited Item - Korblox Deathspeaker', 'items', 54], ['buy-accounts', 'Roblox Account - 2016 Join Date, Rich Inventory', 'account', 120]]],
  ['steal-a-brainrot', [['buy-items', 'Garama and Madundung - Diamond Mutation', 'items', 99], ['buy-accounts', 'Steal a Brainrot Account - Secret Base Unlocked', 'account', 180]]],
]

const MUTATIONS = [
  { slug: 'default', name: 'Default', mult: 1, type: 'default', avail: 'obtainable', premium: 1 },
  { slug: 'gold', name: 'Gold', mult: 1.25, type: 'permanent', avail: 'obtainable', premium: 1.4 },
  { slug: 'diamond', name: 'Diamond', mult: 1.5, type: 'permanent', avail: 'obtainable', premium: 1.8 },
  { slug: 'candy', name: 'Candy', mult: 4, type: 'permanent', avail: 'obtainable', premium: 2.0 },
  { slug: 'lava', name: 'Lava', mult: 6, type: 'permanent', avail: 'obtainable', premium: 2.2 },
  { slug: 'radioactive', name: 'Radioactive', mult: 8.5, type: 'permanent', avail: 'obtainable', premium: 2.4 },
  { slug: 'galaxy', name: 'Galaxy', mult: 7, type: 'permanent', avail: 'obtainable', premium: 2.6 },
  { slug: 'bloodrot', name: 'Bloodrot', mult: 2, type: 'permanent', avail: 'obtainable', premium: 2.8 },
  { slug: 'cursed', name: 'Cursed', mult: 9, type: 'limited', avail: 'event', premium: 2.9 },
  { slug: 'cyber', name: 'Cyber', mult: 7.5, type: 'permanent', avail: 'obtainable', premium: 3.0 },
  { slug: 'phantom', name: 'Phantom', mult: 8, type: 'limited', avail: 'event', premium: 3.1 },
  { slug: 'divine', name: 'Divine', mult: 10, type: 'limited', avail: 'event', premium: 3.2 },
  { slug: 'yin-yang', name: 'Yin Yang', mult: 7.5, type: 'permanent', avail: 'obtainable', premium: 3.3 },
  { slug: 'rainbow', name: 'Rainbow', mult: 10, type: 'permanent', avail: 'obtainable', premium: 3.0 },
]

/** Most valuable first. Past the end, names are synthesised so --sab-items can scale to prod size. */
const BRAINROT_NAMES = [
  'Garama and Madundung', 'La Grande Combinasion', 'Nuclearo Dinossauro', 'Dragon Cannelloni', 'Los Combinasionas',
  'Ketchuru and Musturu', 'Esok Sekolah', 'Tictac Sahur', 'Strawberry Elephant', 'La Sahur Combinasion',
  'Spaghetti Tualetti', 'Chicleteira Bicicleteira', 'Los Hotspotsitos', 'Graipuss Medussi', 'Pot Hotspot',
  'La Vacca Saturno Saturnita', 'Los Tralaleritos', 'Tralalero Tralala', 'Bombardiro Crocodilo', 'Orcalero Orcala',
  'Torrtuginni Dragonfrutini', 'Las Tralaleritas', 'Odin Din Din Dun', 'Agarrini la Palini', 'Chimpanzini Spiderini',
  'Gorillo Watermelondrillo', 'Avocadorilla', 'Cavallo Virtuoso', 'Bombombini Gusini', 'Rhino Toasterino',
  'Orangutini Ananassini', 'Frigo Camelo', 'Blueberrinni Octopussini', 'Glorbo Fruttodrillo', 'Lionel Cactuseli',
  'Chef Crabracadabra', 'Ballerina Cappuccina', 'Chimpanzini Bananini', 'Burbaloni Loliloli', 'Brri Brri Bicus Dicus Bombicus',
  'Perochello Lemonchello', 'Bananita Dolphinita', 'Bambini Crostini', 'Trulimero Trulicina', 'Brr Brr Patapim',
  'Cappuccino Assassino', 'Boneca Ambalabu', 'Bandito Bobritto', 'Gangster Footera', 'Tung Tung Tung Sahur',
  'Trippi Troppi', 'Pipi Kiwi', 'Talpa Di Fero', 'Svinina Bombardino', 'Fluriflura',
  'Tim Cheese', 'Lirili Larila', 'Noobini Pizzanini', 'Sigma Boy', 'Chachechi',
]
const SYL_A = ['Tralalo', 'Brr', 'Pipi', 'Lirili', 'Bombo', 'Cappu', 'Fluri', 'Garama', 'Noobi', 'Tung', 'Svini', 'Trulo', 'Bambi', 'Burba', 'Glorbo', 'Frigo']
const SYL_B = ['nini Pizzanini', ' Bananini', ' Crocodilo', ' Sahur', ' Dolphinita', ' Lemonchello', ' Fruttodrillo', ' Octopussini', ' Cactuseli', ' Toasterino', ' Ambalabu', ' Patapim']

const RARITY_BANDS = [
  [0.03, 'OG'], [0.12, 'Secret'], [0.25, 'Brainrot God'], [0.4, 'Mythic'],
  [0.58, 'Legendary'], [0.76, 'Epic'], [0.9, 'Rare'], [1.01, 'Common'],
]

// ── seed: assets ───────────────────────────────────────────────────────────
async function uploadAssets() {
  const items = []
  for (let i = 0; i < 6; i++) items.push(['listing-images', `measure-seed/item-${i}.png`, artPng(i + 1, 640, 480)])
  for (let i = 0; i < 4; i++) items.push(['profile-pictures', `measure-seed/avatar-${i}.png`, artPng(i + 20, 128, 128)])
  for (let i = 0; i < 4; i++) items.push(['blog-images', `measure-seed/cover-${i}.png`, artPng(i + 40, 800, 450)])
  for (const [bucket, p, buf] of items) {
    const { error } = await svc.storage.from(bucket).upload(p, buf, { contentType: 'image/png', upsert: true })
    if (error) throw new Error(`storage upload ${bucket}/${p}: ${error.message} (is the storage container healthy? \`pnpm db:list\`)`)
  }
  return {
    item: (i) => publicUrl('listing-images', `measure-seed/item-${i % 6}.png`),
    avatar: (i) => publicUrl('profile-pictures', `measure-seed/avatar-${i % 4}.png`),
    cover: (i) => publicUrl('blog-images', `measure-seed/cover-${i % 4}.png`),
    bytes: items.reduce((n, [, , b]) => n + b.length, 0),
    count: items.length,
  }
}

// ── seed: sellers ──────────────────────────────────────────────────────────
async function findAuthUserId(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`auth listUsers: ${error.message}`)
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit.id
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureSellers(art) {
  const tierRows = must(await svc.from('seller_tier_config').select('tier, sort_order').order('sort_order', { ascending: true }), 'seller_tier_config')
  if (!tierRows.length) throw new Error('seller_tier_config is empty - apply migrations first')
  const tiers = tierRows.map((r) => r.tier)

  const existing = must(await svc.from('profiles').select('id, email').like('email', SELLER_EMAIL_LIKE), 'profiles lookup')
  const byEmail = new Map(existing.map((p) => [p.email, p.id]))
  const sellers = []
  for (let i = 0; i < SELLERS.length; i++) {
    const n = i + 1
    const [shopName, shopSlug] = SELLERS[i]
    const email = SELLER_EMAIL(n)
    let id = byEmail.get(email)
    if (!id) {
      const { data, error } = await svc.auth.admin.createUser({
        email,
        password: randomBytes(18).toString('base64url'),
        email_confirm: true,
        user_metadata: { username: `ms-${shopSlug}`, measure_seed: true },
      })
      if (error) {
        if (!/already|registered|exists/i.test(error.message)) throw new Error(`createUser(${email}): ${error.message}`)
        id = await findAuthUserId(email)
        if (!id) throw new Error(`createUser(${email}): reported as existing but not found`)
      } else {
        id = data.user.id
      }
      const prof = must(await svc.from('profiles').select('id').eq('id', id).maybeSingle(), 'profile lookup')
      if (!prof) must(await svc.from('profiles').insert({ id, username: `ms-${shopSlug}`, email }), `profile insert(${email})`)
    }
    const tierIdx = i % tiers.length
    const sales = Math.round(TIER_SALES[tierIdx % TIER_SALES.length] * (0.8 + ((i * 37) % 40) / 100))
    const reviews = Math.round(sales * 0.62)
    const rating = round(4.55 + ((i * 13) % 45) / 100, 2)
    must(
      await svc.from('profiles').update({
        role: 'seller', seller_status: 'active', seller_tier: tiers[tierIdx], is_verified: true, is_test: false,
        username: `ms-${shopSlug}`, shop_name: shopName, shop_slug: shopSlug, email,
        bio: `${shopName}: verified DropMarket seller. Fast delivery, every order covered by SafeDrop Protection.`,
        avatar_url: i % 3 === 2 ? null : art.avatar(i),
        total_sales: sales, total_reviews: reviews, positive_reviews: Math.round(reviews * (rating / 5)),
        seller_rating: Math.min(5, rating), kyc_status: 'approved',
      }).eq('id', id),
      `profile update(${email})`,
    )
    sellers.push({ id, email, shopName })
  }
  must(
    await svc.from('seller_presence').upsert(
      sellers.map((s, i) => ({
        seller_id: s.id, is_online: i % 2 === 0, store_paused: false,
        last_seen_at: hoursAgo(i % 2 === 0 ? 0.1 : 6 + i), last_active_at: hoursAgo(i % 2 === 0 ? 0.1 : 6 + i),
      })),
      { onConflict: 'seller_id' },
    ),
    'seller_presence upsert',
  )
  return sellers
}

// ── seed: categories (Valorant gets the pairs the real site has) ───────────
async function ensureValorantPairs(games) {
  const { ensureGameCategory } = await import('../src/lib/categories/ensure.ts')
  const { getCanonicalCategorySlug } = await import('../src/lib/utils/category-canonical.ts')
  const { DEFAULT_CURRENCY_CONFIG } = await import('../src/lib/types/category-configs.ts')
  const deps = { canonicalSlug: getCanonicalCategorySlug, currencyConfig: DEFAULT_CURRENCY_CONFIG }
  const gameId = games.get('valorant').id
  const created = []

  for (const [globalSlug, name] of [['currency', 'VP (Valorant Points)'], ['items', 'Items']]) {
    // The ONE way a pair comes into existence (CLAUDE.md): ensureGameCategory.
    const r = await ensureGameCategory(svc, { gameId, globalSlug, name, seedCurrencyConfig: false }, deps)
    if (r.created) {
      // Marker so --clean removes only pairs THIS script created.
      must(await svc.from('game_categories').update({ extras: { measure_seed: true } }).eq('id', r.id), 'mark game_categories')
      created.push(r.slug)
    }
  }

  const cur = must(await svc.from('game_categories').select('id, slug').eq('game_id', gameId).eq('type', 'currency').eq('is_enabled', true).maybeSingle(), 'valorant currency pair')
  if (!cur || cur.slug !== 'buy-vp') throw new Error(`expected valorant currency slug buy-vp, got ${cur?.slug}`)

  const cfgRow = must(await svc.from('category_configs').select('id').eq('game_id', gameId).eq('category_type', 'currency').maybeSingle(), 'category_configs lookup')
  if (!cfgRow) {
    const config = {
      ...DEFAULT_CURRENCY_CONFIG,
      unit_label: 'VP',
      glyph: 'VP',
      tagline: 'Valorant Points from verified sellers. Pay once, get your VP, or get your money back.',
      price_floor: 0.001,
      price_ceiling: 0.05,
      recommended_price: 0.0085,
      min_quantity: 100,
      quantity_step: 100,
      quantity_granularity: 'unit',
      seller_instructions_placeholder: 'Tell buyers how you deliver VP (gift cards, region, timing).',
      faq: [
        { q: 'How do I get my Valorant Points?', a: 'After payment the seller delivers VP to your account (usually as a region-matched gift card or direct top-up). Most orders finish within minutes.' },
        { q: 'Is buying VP from a third party safe?', a: 'Every order is covered by SafeDrop Protection. If your VP is not delivered or not as described, you get a full refund.' },
        { q: 'Which regions are supported?', a: 'Sellers list the region they deliver to (NA, EU, APAC, LATAM). Pick an offer that matches your Riot account region.' },
        { q: 'Why are prices different between sellers?', a: 'Each seller sets their own price per VP. Compare price, delivery time and rating, then pick the offer that suits you.' },
        { q: 'What if my order is late?', a: 'You can message the seller from the order page. If it is not resolved, open a dispute and our team steps in.' },
      ],
    }
    must(await svc.from('category_configs').insert({ game_id: gameId, category_type: 'currency', config }), 'category_configs insert')
  }
  return created
}

// ── seed: listings ─────────────────────────────────────────────────────────
function buildListingDefs(art) {
  const defs = []
  const add = (d) => defs.push({ idx: defs.length, ...d })

  VP_PRICES.forEach((price, j) => {
    add({
      key: `valorant:vp:${j}`, game: 'valorant', cat: 'buy-vp', kind: 'currency',
      title: `${VP_ADJ[j % 5]} Valorant Points (VP) - ${VP_REGION[j % 4]} Region`,
      desc: `Valorant Points delivered to your ${VP_REGION[j % 4]} Riot account. Message me your Riot ID after ordering and I will top up. Covered by SafeDrop Protection.`,
      price, qty: VP_STOCK[j], min: VP_MIN[j], delivery: VP_DELIVERY[j], images: [], template: null,
    })
  })
  VAL_SKINS.forEach(([name, rarity, price], j) => {
    add({
      key: `valorant:item:${j}`, game: 'valorant', cat: 'buy-items', kind: 'items',
      title: `${name} - Valorant Skin | Fast Delivery`,
      desc: `${name} (${rarity}) delivered by account gift or trade. Region and platform noted in chat. Covered by SafeDrop Protection.`,
      price, orig: j % 3 === 0 ? round(price * 1.18) : null, qty: 1 + (j % 5) * 2, min: 1,
      delivery: ['instant', '15min', '1hr', '30min'][j % 4], images: j % 2 ? [art.item(j), art.item(j + 1)] : [art.item(j)],
      template: { skin: name, rarity },
    })
  })
  VAL_RANKS.forEach(([rank, price], j) => {
    const skins = 8 + ((j * 17) % 120)
    const region = VP_REGION[j % 4]
    add({
      key: `valorant:account:${j}`, game: 'valorant', cat: 'buy-accounts', kind: 'account',
      title: `${rank} Valorant Account - ${skins} Skins - ${region}`,
      desc: `${rank} account on ${region}. ${skins} skins, full access, email changeable. Credentials handed over in chat after payment. Covered by SafeDrop Protection.`,
      price, qty: 1, min: 1, delivery: ['instant', '30min', '1hr', '2hr'][j % 4], images: [art.item(j + 2), art.item(j + 3)],
      template: { rank, region, skins, level: 30 + ((j * 23) % 270) },
    })
  })
  for (const [game, list] of OTHER_GAMES) {
    list.forEach(([cat, title, kind, price], j) => {
      add({
        key: `${game}:${cat}:${j}`, game, cat, kind, title,
        desc: `${title}. Delivered by in-game trade or account handover after payment. Message me once you order. Covered by SafeDrop Protection.`,
        price, qty: kind === 'currency' ? 500000 : kind === 'account' ? 1 : 3 + j, min: kind === 'currency' ? 1000 : 1,
        delivery: ['instant', '15min', '1hr'][(defs.length + j) % 3],
        images: kind === 'currency' ? [] : [art.item(defs.length), art.item(defs.length + 3)],
        template: kind === 'items' ? { item: title.split(' - ')[0] } : kind === 'account' ? { region: 'NA' } : null,
      })
    })
  }
  return defs
}

async function seedListings(sellers, games, art) {
  const defs = buildListingDefs(art)

  // (game slug, category slug) -> game_categories row
  const slugs = [...new Set(defs.map((d) => d.game))]
  const cats = must(
    await svc.from('game_categories').select('id, slug, type, is_enabled, game_id').in('game_id', slugs.map((s) => games.get(s).id)).eq('is_enabled', true),
    'game_categories lookup',
  )
  const catKey = new Map(cats.map((c) => [`${c.game_id}/${c.slug}`, c]))

  const rows = []
  for (const d of defs) {
    const game = games.get(d.game)
    const cat = catKey.get(`${game.id}/${d.cat}`)
    if (!cat) throw new Error(`no enabled category ${d.game}/${d.cat} on this stack`)
    const seller = sellers[(d.idx * 5 + (d.idx % 7)) % sellers.length]
    const created = hoursAgo((d.idx * 5 + (d.idx % 3) * 2) % 300 + 1)
    rows.push({
      id: uuid(`listing:${d.key}`),
      seller_id: seller.id, game_id: game.id, game_category_id: cat.id,
      title: d.title, description: d.desc, price: d.price, currency: 'USD',
      original_price: d.orig ?? null, quantity: d.qty, min_quantity: d.min, is_unlimited: false,
      status: 'active', images: d.images, delivery_time: d.delivery, delivery_method: 'manual',
      template_data: d.template, view_count: 12 + ((d.idx * 41) % 400), views: 12 + ((d.idx * 41) % 400),
      // An approved row: check_listing_moderation sends a bronze seller's new listing to
      // pending_approval unless approved_by is set. Service role may set it (guarded_write_allowed).
      approved_by: sellers[0].id, approved_at: created,
      created_at: created, updated_at: created,
    })
  }

  const have = new Set()
  for (const ids of chunks(rows.map((r) => r.id), 80)) {
    for (const r of must(await svc.from('listings').select('id').in('id', ids), 'listings lookup')) have.add(r.id)
  }
  const missing = rows.filter((r) => !have.has(r.id))
  for (const part of chunks(missing, 25)) must(await svc.from('listings').insert(part), 'listings insert')
  return { total: rows.length, inserted: missing.length }
}

// ── seed: Steal a Brainrot catalogue ───────────────────────────────────────
function brainrotCatalogue(n) {
  const names = []
  const seen = new Set()
  for (let i = 0; i < n; i++) {
    let name = BRAINROT_NAMES[i] ?? `${SYL_A[i % SYL_A.length]}${SYL_B[(i * 5) % SYL_B.length]}`
    if (seen.has(slugify(name))) name = `${name} ${i + 1}`
    seen.add(slugify(name))
    names.push(name)
  }
  const rnd = prng(7)
  return names.map((name, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    // ~2,500 USD at the top, ~0.55 at the tail, log-linear with jitter.
    const price = round(Math.exp(Math.log(2500) + (Math.log(0.55) - Math.log(2500)) * Math.pow(t, 0.9)) * (0.94 + rnd() * 0.12))
    const rarity = RARITY_BANDS.find(([cut]) => t < cut)[1]
    const income = Math.round(Math.pow(price, 1.12) * 1200)
    return {
      i, name, slug: slugify(name), rarity, price, income,
      cost: Math.round(income * (40 + rnd() * 30)),
      sample: Math.max(3, Math.round(3 + (1 - t) * 6 + rnd() * 30 * Math.pow(1 - t, 0.4))),
    }
  })
}

/**
 * The item page worth measuring: mid-table (a rarity band with many siblings for the "similar" block),
 * priced in four mutations, with 30 days of history on four series. Pure function of n.
 */
const recommendedIndex = (n) => Math.floor(n * 0.45)

async function seedSab(n) {
  const cat = brainrotCatalogue(n)

  // Refuse to adopt rows that are not ours.
  for (const part of chunks(cat.map((b) => b.slug), 60)) {
    const clash = must(await svc.from('sab_brainrots').select('slug, source_name').in('slug', part), 'sab slug check').filter((r) => r.source_name !== SAB_MARK)
    if (clash.length) throw new Error(`sab_brainrots already holds real rows with these slugs (${clash.slice(0, 3).map((r) => r.slug).join(', ')}...). Refusing to overwrite them.`)
  }

  // Mutations: insert-if-missing (a stack that already has the real 14 keeps them).
  must(
    await svc.from('sab_mutations').upsert(
      MUTATIONS.map((m) => ({ name: m.name, slug: m.slug, income_multiplier: m.mult, mutation_type: m.type, availability: m.avail, source_url: MUT_MARK, is_active: true })),
      { onConflict: 'slug', ignoreDuplicates: true },
    ),
    'sab_mutations upsert',
  )
  const mutRows = must(await svc.from('sab_mutations').select('id, slug, income_multiplier').in('slug', MUTATIONS.map((m) => m.slug)), 'sab_mutations read')
  const mutId = new Map(mutRows.map((m) => [m.slug, m.id]))
  if (mutId.size !== MUTATIONS.length) throw new Error('sab_mutations incomplete after upsert')

  must(
    await svc.from('sab_mutation_price_multipliers').upsert(
      MUTATIONS.filter((m) => m.slug !== 'default').map((m) => ({ mutation_slug: m.slug, price_multiplier: m.premium, pair_count: 0 })),
      { onConflict: 'mutation_slug', ignoreDuplicates: true },
    ),
    'sab_mutation_price_multipliers upsert',
  )

  // Popularity: a deterministic shuffle of 1..n.
  const order = cat.map((b) => b.i).sort((a, b) => ((a * 2654435761) >>> 0) - ((b * 2654435761) >>> 0))
  const rankOf = new Map(order.map((i, r) => [i, r + 1]))

  const brainrotRows = cat.map((b) => ({
    id: uuid(`sab:${b.slug}`), name: b.name, slug: b.slug, aliases: [], rarity: b.rarity,
    base_income_per_second: b.income, ingame_cost: b.cost,
    obtainability: b.i % 9 === 4 ? 'limited' : 'obtainable',
    acquisition_method: 'Hatch from the conveyor or buy from the Brainrot Merchant',
    // image_path stays NULL on purpose: sab_brainrot_catalog hardcodes the PRODUCTION storage host in image_url
    // ('https://<prod>.supabase.co/.../' || image_path). NULL keeps every request local.
    image_path: null, image_alt_text: `${b.name} Steal a Brainrot`, image_status: 'approved',
    source_name: SAB_MARK, needs_review: false, is_active: true, is_tradeable: true,
    popularity_rank: rankOf.get(b.i),
  }))
  for (const part of chunks(brainrotRows, 100)) must(await svc.from('sab_brainrots').upsert(part, { onConflict: 'slug' }), 'sab_brainrots upsert')

  const ids = brainrotRows.map((r) => r.id)
  const idOf = new Map(cat.map((b, i) => [b.slug, ids[i]]))

  // Snapshots (feed sab_brainrot_market_catalog): replace ours.
  for (const part of chunks(ids, 80)) must(await svc.from('sab_price_snapshots').delete().in('brainrot_id', part), 'snapshots delete')
  const snaps = cat.map((b) => ({
    brainrot_id: idOf.get(b.slug), mutation_id: null,
    market_floor_usd: round(b.price * 0.82), quick_sale_usd: round(b.price * 0.88), typical_sale_usd: b.price,
    patient_sale_usd: round(b.price * 1.2), observed_low_usd: round(b.price * 0.74), observed_high_usd: round(b.price * 1.6),
    active_listing_count: b.sample, completed_sale_count: Math.round(b.sample * 0.4), unique_seller_count: Math.max(2, Math.round(b.sample * 0.5)),
    confidence_score: Math.min(95, 30 + b.sample * 2), confidence_label: b.sample >= 15 ? 'high' : b.sample >= 6 ? 'medium' : 'low',
    calculation_version: 'v1', calculated_at: hoursAgo(1 + (b.i % 10)),
  }))
  for (const part of chunks(snaps, 100)) must(await svc.from('sab_price_snapshots').insert(part), 'snapshots insert')

  // Display rows: default for everyone; priced mutations for the top of the table.
  const rnd = prng(11)
  const display = []
  const priceNote = (b) => (b.sample >= 15 ? 'high' : b.sample >= 6 ? 'medium' : 'low')
  for (const b of cat) {
    const id = idOf.get(b.slug)
    const muts = [{ m: MUTATIONS[0], v: b.price, sample: b.sample }]
    const f = b.i / n
    const extra = f < 0.17 ? ['gold', 'diamond', 'candy', 'lava', 'galaxy', 'rainbow'] : f < 0.47 ? ['gold', 'diamond', 'rainbow'] : f < 0.75 ? ['gold'] : []
    for (const slug of extra) {
      const m = MUTATIONS.find((x) => x.slug === slug)
      muts.push({ m, v: round(b.price * m.premium * (0.9 + rnd() * 0.25)), sample: Math.max(3, Math.round(b.sample * (0.25 + rnd() * 0.3))) })
    }
    for (const { m, v, sample } of muts) {
      display.push({
        brainrot_id: id, brainrot_name: b.name, brainrot_slug: b.slug, rarity: b.rarity, image_url: null,
        mutation_id: mutId.get(m.slug), mutation_name: m.name, mutation_slug: m.slug,
        market_value_usd: v, market_low_usd: round(v * 0.74), market_high_usd: round(v * 1.6),
        confidence_label: sample >= 15 ? 'high' : sample >= 6 ? 'medium' : 'low', external_sample_size: sample, source_count: 2,
        price_updated_at: hoursAgo(1 + (b.i % 10)), is_trade_ready: true, is_public_estimate: true, is_anchored: false,
        correction_reason: null, anchor_usd: null, cohort_size: sample,
        cheapest_usd: round(v * 0.82), average_usd: v, refreshed_at: hoursAgo(1),
      })
    }
  }
  // Replace ours (not upsert-only): a rerun with a different --sab-items must not leave stale mutation rows behind.
  for (const part of chunks(ids, 80)) must(await svc.from('sab_price_display').delete().in('brainrot_id', part), 'display delete')
  for (const part of chunks(display, 200)) must(await svc.from('sab_price_display').insert(part), 'sab_price_display insert')

  // Prune items from an earlier, larger run (marker rows that are no longer in the catalogue).
  const keep = new Set(ids)
  const stale = []
  for (let from = 0; ; from += 1000) {
    const rows = must(await svc.from('sab_brainrots').select('id').eq('source_name', SAB_MARK).range(from, from + 999), 'sab marker ids')
    stale.push(...rows.map((r) => r.id).filter((id) => !keep.has(id)))
    if (rows.length < 1000) break
  }
  for (const part of chunks(stale, 80)) {
    must(await svc.from('sab_price_display').delete().in('brainrot_id', part), 'stale display delete')
    must(await svc.from('sab_brainrots').delete().in('id', part), 'stale brainrots delete')
  }

  // Price history: top 8 items x 30 days (default), top 3 also gold / diamond / rainbow.
  for (const part of chunks(ids, 80)) must(await svc.from('sab_price_history').delete().in('brainrot_id', part), 'history delete')
  const history = []
  const hist = (b, slug, base) => {
    const r = prng(1000 + b.i * 31 + slug.length * 7)
    const phase = r() * 6
    for (let d = 29; d >= 0; d--) {
      const wave = 0.5 + 0.5 * Math.sin((29 - d) / 4.2 + phase)
      const median = d === 0 ? base : round(base * (0.86 + 0.26 * wave + (r() - 0.5) * 0.04))
      history.push({
        brainrot_id: idOf.get(b.slug), mutation_id: mutId.get(slug), history_date: dayStr(d),
        median_usd: median, low_usd: round(median * 0.85), high_usd: round(median * 1.25),
        listing_count: Math.max(3, b.sample + Math.round((r() - 0.5) * 8)), source_count: 2,
        confidence_label: b.sample >= 15 ? 'high' : 'medium', is_trade_ready: true, is_public_estimate: true,
        price_updated_at: hoursAgo(d * 24 + 1),
      })
    }
  }
  const recIdx = recommendedIndex(n)
  const histIdx = [...new Set([0, 1, 2, 3, 4, 5, 6, 7, Math.floor(n * 0.3), recIdx, Math.floor(n * 0.55)])].filter((i) => i < n)
  for (const i of histIdx) {
    const b = cat[i]
    hist(b, 'default', b.price)
    // Extra series (gold / diamond / rainbow) for the top 3 and for the recommended item, so the chart's variant picker has choices.
    if (i < 3 || i === recIdx) {
      for (const slug of ['gold', 'diamond', 'rainbow']) {
        const row = display.find((x) => x.brainrot_id === idOf.get(b.slug) && x.mutation_slug === slug)
        if (row) hist(b, slug, row.market_value_usd)
      }
    }
  }
  for (const part of chunks(history, 200)) must(await svc.from('sab_price_history').insert(part), 'history insert')

  return { items: cat.length, display: display.length, history: history.length, snaps: snaps.length, recommended: cat[recIdx].slug, rarity: cat[recIdx].rarity }
}

// ── seed: blog posts ───────────────────────────────────────────────────────
async function seedBlog(art) {
  const rows = BLOG_POSTS.map(([game, slug, title, type, mins, excerpt], i) => ({
    slug, title, excerpt, author: 'DropMarket Team', read_minutes: mins, post_type: type, status: 'published',
    primary_game_slug: game, game_slugs: [game], cover_url: art.cover(i), body: [],
    seo_title: title, seo_description: excerpt, published_at: hoursAgo(24 * (i + 2)),
  }))
  must(await svc.from('blog_posts').upsert(rows, { onConflict: 'primary_game_slug,slug' }), 'blog_posts upsert')
  return rows.length
}

// ── counts + verification ──────────────────────────────────────────────────
async function countIn(table, col, ids, extra) {
  let n = 0
  for (const part of chunks(ids, 80)) {
    let q = svc.from(table).select('*', { count: 'exact' }).in(col, part).limit(1)
    if (extra) q = extra(q)
    const res = await q
    if (res.error) throw new Error(`count ${table}: ${res.error.message}`)
    n += res.count ?? 0
  }
  return n
}
async function countWhere(client, table, apply) {
  const res = await apply(client.from(table).select('*', { count: 'exact' }).limit(1))
  if (res.error) throw new Error(`count ${table}: ${res.error.message}`)
  return res.count ?? 0
}

async function seedCounts() {
  const sellerIds = must(await svc.from('profiles').select('id').like('email', SELLER_EMAIL_LIKE), 'profiles').map((p) => p.id)
  const brainrotIds = []
  for (let from = 0; ; from += 1000) {
    const rows = must(await svc.from('sab_brainrots').select('id').eq('source_name', SAB_MARK).range(from, from + 999), 'sab_brainrots ids')
    brainrotIds.push(...rows.map((r) => r.id))
    if (rows.length < 1000) break
  }
  const out = {
    'auth.users / profiles (sellers)': sellerIds.length,
    seller_presence: await countIn('seller_presence', 'seller_id', sellerIds),
    'listings (active)': await countIn('listings', 'seller_id', sellerIds, (q) => q.eq('status', 'active')),
    'game_categories (created here)': await countWhere(svc, 'game_categories', (q) => q.eq('extras->>measure_seed', 'true')),
    'category_configs (valorant currency)': await countWhere(svc, 'category_configs', (q) => q.eq('category_type', 'currency').eq('game_id', GAME_IDS.valorant ?? '00000000-0000-0000-0000-000000000000')),
    'sab_mutations (created here)': await countWhere(svc, 'sab_mutations', (q) => q.eq('source_url', MUT_MARK)),
    'sab_mutation_price_multipliers': await countWhere(svc, 'sab_mutation_price_multipliers', (q) => q.eq('pair_count', 0)),
    sab_brainrots: brainrotIds.length,
    sab_price_display: await countIn('sab_price_display', 'brainrot_id', brainrotIds),
    sab_price_snapshots: await countIn('sab_price_snapshots', 'brainrot_id', brainrotIds),
    sab_price_history: await countIn('sab_price_history', 'brainrot_id', brainrotIds),
    blog_posts: await countWhere(svc, 'blog_posts', (q) => q.in('slug', BLOG_POSTS.map((b) => b[1]))),
  }
  let objs = 0
  for (const b of BUCKETS) {
    const { data } = await svc.storage.from(b).list('measure-seed', { limit: 100 })
    objs += data?.length ?? 0
  }
  out['storage objects'] = objs
  return out
}
const GAME_IDS = {}

/** Anon-key reads shaped like the pages' own queries. Returns false if anything the pages need is missing. */
async function verify(opts = {}) {
  const results = []
  const check = (name, value, min, note = '') => {
    const ok = value >= min
    results.push({ name, value, min, ok, note })
  }

  const games = must(await anon.from('games').select('id, slug').eq('is_active', true), 'anon games')
  const gameBySlug = new Map(games.map((g) => [g.slug, g]))
  const valorant = gameBySlug.get('valorant')
  const sab = gameBySlug.get('steal-a-brainrot')
  if (!valorant || !sab) throw new Error('valorant / steal-a-brainrot missing from games')
  GAME_IDS.valorant = valorant.id

  // "/" latest listings: the page's own select (inner joins, non-test, active game).
  const latest = must(
    await anon.from('listings').select(`id, title, price, images, slug, quantity, delivery_time,
      game:games!inner(id, slug, name, is_active, image_url),
      category:game_categories!listings_game_category_id_fkey!inner(slug, name, type),
      seller:public_profiles!listings_seller_id_fkey!inner(is_test)`)
      .eq('status', 'active').eq('seller.is_test', false).eq('game.is_active', true).order('price', { ascending: true }).limit(200),
    'anon latest listings',
  )
  const eligible = latest.filter((r) => r.category.type !== 'items' || (r.images?.[0] && !r.images[0].startsWith('/games/')))
  check('home: latest-listings rows visible to anon (rail wants 30)', eligible.length, 30)
  check('home: distinct games among them', new Set(eligible.map((r) => r.game.slug)).size, 10)

  // "/" top-selling games rail: homepage allowlist with live listings.
  const HOMEPAGE = ['adopt-me', 'apex-legends', 'blade-ball', 'cs2', 'fc26', 'fortnite', 'grow-a-garden-2', 'gta-vi', 'r6-siege', 'roblox', 'steal-a-brainrot', 'valorant']
  const lst = must(await anon.from('listings').select('game_id, price, seller:public_profiles!listings_seller_id_fkey!inner(is_test)').eq('status', 'active').eq('seller.is_test', false), 'anon popular games')
  const withStock = new Set(lst.map((l) => l.game_id))
  check('home: allowlisted games with live listings (rail wants 10)', HOMEPAGE.filter((s) => gameBySlug.has(s) && withStock.has(gameBySlug.get(s).id)).length, 10)

  // "/valorant" hub.
  const cats = must(await anon.from('game_categories').select('id, slug, type').eq('game_id', valorant.id).eq('is_enabled', true), 'anon valorant categories')
  check('valorant hub: enabled categories (currency + items + accounts)', cats.length, 3)
  for (const [type, label, min] of [['items', 'items rail', 12], ['account', 'accounts rail', 12]]) {
    const ids = cats.filter((c) => c.type === type).map((c) => c.id)
    const rows = must(
      await anon.from('listings').select(`id, price, seller:public_profiles!listings_seller_id_fkey(id, shop_name, seller_tier)`)
        .eq('game_id', valorant.id).eq('status', 'active').in('game_category_id', ids).limit(60),
      `anon hub ${label}`,
    )
    check(`valorant hub: ${label} offers (wants ${min}+)`, rows.length, min)
  }

  // "/valorant/buy-vp".
  const pair = must(await anon.from('game_categories').select('id, slug, type').eq('game_id', valorant.id).eq('slug', 'buy-vp').eq('is_enabled', true).maybeSingle(), 'anon buy-vp pair')
  check('valorant/buy-vp: category resolves (route gate)', pair ? 1 : 0, 1)
  const cfg = must(await anon.from('category_configs').select('config').eq('game_id', valorant.id).eq('category_type', 'currency').maybeSingle(), 'anon category_configs')
  check('valorant/buy-vp: currency config readable (FAQ entries)', cfg?.config?.faq?.length ?? 0, 1)
  if (pair) {
    const offers = must(
      await anon.from('listings').select(`id, price, quantity, min_quantity, delivery_time,
        seller:public_profiles!listings_seller_id_fkey(id, username, shop_name, shop_slug, avatar_url, seller_tier, seller_rating, total_reviews, total_sales, is_verified)`)
        .eq('game_id', valorant.id).eq('game_category_id', pair.id).eq('status', 'active').order('price', { ascending: true }).limit(50),
      'anon buy-vp offers',
    )
    check('valorant/buy-vp: offers (wants 14+)', offers.length, 14)
    check('valorant/buy-vp: distinct prices', new Set(offers.map((o) => Number(o.price))).size, 14)
    check('valorant/buy-vp: offers with a seller row', offers.filter((o) => o.seller?.id).length, 14)
  }

  // SAB values hub.
  const catalog = await countWhere(anon, 'sab_brainrot_market_catalog', (q) => q)
  check(`SAB hub: sab_brainrot_market_catalog rows`, catalog, SAB_ITEMS)
  check('SAB hub: default price rows with a market value', await countWhere(anon, 'sab_price_display', (q) => q.eq('mutation_slug', 'default').not('market_value_usd', 'is', null)), SAB_ITEMS)
  check('SAB hub: priced mutation rows (cheapest_usd)', await countWhere(anon, 'sab_price_display', (q) => q.not('cheapest_usd', 'is', null)), SAB_ITEMS)
  check('SAB hub: mutation calculator rows (items x 14)', await countWhere(anon, 'sab_brainrot_mutation_calculator', (q) => q), SAB_ITEMS * 14)
  check('SAB hub: popularity ranks', await countWhere(anon, 'sab_brainrots', (q) => q.not('popularity_rank', 'is', null)), SAB_ITEMS)
  const since = dayStr(8)
  const mv = must(await anon.from('sab_price_history').select('brainrot_id, history_date, median_usd, sab_mutations!inner(slug)').eq('sab_mutations.slug', 'default').gte('history_date', since).order('history_date', { ascending: true }).limit(1000), 'anon movers')
  check('SAB hub: distinct history days in the last 8 (movers need 2)', new Set(mv.map((r) => r.history_date)).size, 2)

  // SAB item page for the recommended slug.
  const slug = opts.slug ?? (await recommendedSlug())
  if (slug) {
    const item = must(await anon.from('sab_brainrot_market_catalog').select('id, name, slug, rarity').eq('slug', slug).maybeSingle(), 'anon item')
    check(`SAB item ${slug}: catalog row`, item ? 1 : 0, 1)
    if (item) {
      const defMutId = must(await anon.from('sab_mutations').select('id').eq('slug', 'default').maybeSingle(), 'anon default mutation')?.id
      const def = must(await anon.from('sab_price_display').select('market_value_usd, external_sample_size, cheapest_usd, average_usd').eq('brainrot_id', item.id).eq('mutation_slug', 'default').maybeSingle(), 'anon item price')
      check(`SAB item ${slug}: default sample_size (wants 3+)`, def?.external_sample_size ?? 0, 3)
      check(`SAB item ${slug}: mutation calculator rows`, await countWhere(anon, 'sab_brainrot_mutation_calculator', (q) => q.eq('brainrot_id', item.id)), 14)
      check(`SAB item ${slug}: priced mutations`, await countWhere(anon, 'sab_price_display', (q) => q.eq('brainrot_id', item.id)), 4)
      check(`SAB item ${slug}: default price-history points (chart wants ~30)`, await countWhere(anon, 'sab_price_history', (q) => q.eq('brainrot_id', item.id).eq('mutation_id', defMutId)), 30)
      check(`SAB item ${slug}: all price-history points (4 series)`, await countWhere(anon, 'sab_price_history', (q) => q.eq('brainrot_id', item.id)), 120)
      check(`SAB item ${slug}: same-rarity siblings (similar block, prod shows up to 20)`, await countWhere(anon, 'sab_brainrot_market_catalog', (q) => q.eq('rarity', item.rarity).neq('id', item.id)), Math.min(10, Math.floor(SAB_ITEMS * 0.12)))
    }
    check('SAB item: mutation price multipliers readable', await countWhere(anon, 'sab_mutation_price_multipliers', (q) => q), 13)
  }

  // Blog rails.
  for (const g of ['valorant', 'steal-a-brainrot']) {
    check(`blog rail for ${g}`, await countWhere(anon, 'blog_posts', (q) => q.eq('status', 'published').contains('game_slugs', [g])), 4)
  }

  console.log('\n  anon-key reads (what the public pages see)')
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${String(r.value).padStart(5)} (min ${r.min})  ${r.name}`)
  const bad = results.filter((r) => !r.ok)
  console.log(bad.length ? `\n  ${bad.length} check(s) FAILED\n` : `\n  all ${results.length} checks passed\n`)
  return bad.length === 0
}

async function recommendedSlug() {
  return brainrotCatalogue(SAB_ITEMS)[recommendedIndex(SAB_ITEMS)].slug
}

// ── clean ──────────────────────────────────────────────────────────────────
async function clean() {
  const report = {}
  const sellerIds = must(await svc.from('profiles').select('id').like('email', SELLER_EMAIL_LIKE), 'profiles').map((p) => p.id)

  let n = 0
  for (const part of chunks(sellerIds, 80)) n += must(await svc.from('listings').delete().in('seller_id', part).select('id'), 'listings delete').length
  report.listings = n

  report.blog_posts = must(await svc.from('blog_posts').delete().in('slug', BLOG_POSTS.map((b) => b[1])).select('id'), 'blog delete').length

  const brainrotIds = []
  for (;;) {
    const rows = must(await svc.from('sab_brainrots').select('id').eq('source_name', SAB_MARK).limit(1000), 'sab ids')
    if (!rows.length) break
    brainrotIds.push(...rows.map((r) => r.id))
    for (const part of chunks(rows.map((r) => r.id), 80)) {
      must(await svc.from('sab_price_display').delete().in('brainrot_id', part), 'display delete')
      must(await svc.from('sab_brainrots').delete().in('id', part), 'sab_brainrots delete') // history + snapshots cascade
    }
  }
  report.sab_brainrots = brainrotIds.length
  report.sab_mutations = must(await svc.from('sab_mutations').delete().eq('source_url', MUT_MARK).select('id'), 'sab_mutations delete').length
  report.sab_mutation_price_multipliers = must(
    await svc.from('sab_mutation_price_multipliers').delete().eq('pair_count', 0).in('mutation_slug', MUTATIONS.map((m) => m.slug)).select('mutation_slug'),
    'multipliers delete',
  ).length

  // Pairs this script created (marker), with their legacy mirror row and the currency config.
  const pairs = must(await svc.from('game_categories').select('id, game_id, type, legacy_category_id').eq('extras->>measure_seed', 'true'), 'marked pairs')
  for (const p of pairs) {
    if (p.type === 'currency') must(await svc.from('category_configs').delete().eq('game_id', p.game_id).eq('category_type', 'currency'), 'category_configs delete')
    must(await svc.from('game_categories').delete().eq('id', p.id), 'game_categories delete')
    if (p.legacy_category_id) must(await svc.from('categories').delete().eq('id', p.legacy_category_id), 'legacy categories delete')
  }
  report.game_categories = pairs.length

  let users = 0
  for (let i = 1; i <= SELLERS.length; i++) {
    const email = SELLER_EMAIL(i)
    const fromProfile = sellerIds.length ? must(await svc.from('profiles').select('id').eq('email', email).maybeSingle(), 'profile') : null
    const id = fromProfile?.id ?? (await findAuthUserId(email))
    if (!id) continue
    const { error } = await svc.auth.admin.deleteUser(id)
    if (error) throw new Error(`deleteUser(${email}): ${error.message}`)
    users++
  }
  report['auth users (profiles + presence cascade)'] = users

  let objs = 0
  for (const b of BUCKETS) {
    const { data } = await svc.storage.from(b).list('measure-seed', { limit: 100 })
    const names = (data ?? []).map((o) => `measure-seed/${o.name}`)
    if (names.length) {
      const { error } = await svc.storage.from(b).remove(names)
      if (error) throw new Error(`storage remove ${b}: ${error.message}`)
      objs += names.length
    }
  }
  report['storage objects'] = objs

  console.log('\n  measure-seed --clean: removed')
  for (const [k, v] of Object.entries(report)) console.log(`    ${String(v).padStart(5)}  ${k}`)
  console.log('')
}

// ── main ───────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n  measure-seed -> ${BASE} (local stack, .env.test)  sab-items=${SAB_ITEMS}`)

  const wanted = ['valorant', 'steal-a-brainrot', ...OTHER_GAMES.map(([g]) => g)]
  const rows = must(await svc.from('games').select('id, slug, is_active').in('slug', [...new Set(wanted)]), 'games lookup')
  const games = new Map(rows.map((g) => [g.slug, g]))
  for (const s of new Set(wanted)) {
    if (!games.get(s)?.is_active) throw new Error(`game "${s}" is missing or inactive on this stack - run \`pnpm test:reset\` (seeds the 233 games)`)
    GAME_IDS[s] = games.get(s).id
  }

  const art = await uploadAssets()
  console.log(`  assets      ${art.count} synthetic PNGs uploaded to local storage (${Math.round(art.bytes / 1024)} KB total)`)
  const sellers = await ensureSellers(art)
  console.log(`  sellers     ${sellers.length} verified, non-test, unpaused`)
  const newPairs = await ensureValorantPairs(games)
  console.log(`  categories  valorant pairs ensured${newPairs.length ? ` (created: ${newPairs.join(', ')})` : ' (already present)'}`)
  const l = await seedListings(sellers, games, art)
  console.log(`  listings    ${l.total} active (${l.inserted} newly inserted)`)
  const s = await seedSab(SAB_ITEMS)
  console.log(`  SAB         ${s.items} brainrots, ${s.display} price rows, ${s.history} history points, ${s.snaps} snapshots`)
  const b = await seedBlog(art)
  console.log(`  blog        ${b} published posts`)

  console.log('\n  row counts (service role)')
  for (const [k, v] of Object.entries(await seedCounts())) console.log(`    ${String(v).padStart(5)}  ${k}`)
  console.log(`\n  recommended value-item route: /steal-a-brainrot/values/${s.recommended}`)
  const ok = await verify({ slug: s.recommended })
  if (!ok) process.exitCode = 1
}

try {
  if (CLEAN) await clean()
  else if (VERIFY_ONLY) process.exitCode = (await verify()) ? 0 : 1
  else await seed()
} catch (e) {
  die(e?.message ?? String(e))
}
