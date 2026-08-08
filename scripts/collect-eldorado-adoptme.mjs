/**
 * Adopt Me CASH/USD collector — Eldorado marketplace
 * ============================================================================
 * Mirrors the SAB Eldorado collector, adapted to Adopt Me:
 *   - gameId 201 (SAB was 259), category CustomItem
 *   - variant comes from the offer's structured "Traits" attribute, not the
 *     title — cleaner than SAB's title parsing
 *
 * For each pet in adopt_me_pets it searches the offers API, keeps only offers
 * whose title is an EXACT pet-name match with a recognised trait (so noise like
 * "Shadow Dragon Ducky" — a different pet — is excluded), and records each
 * clean listing's USD price + variant. Writes raw listings to JSON; the
 * importer computes the per-variant median and confidence.
 *
 * Polite: one pet at a time, delay between pets, a few pages each. Tune with
 * flags. USER runs this against the live site (as the SAB collector is run).
 *
 * Usage:
 *   node scripts/collect-eldorado-adoptme.mjs --limit 5        # test on 5 pets
 *   node scripts/collect-eldorado-adoptme.mjs                  # all pets → JSON
 *   node scripts/collect-eldorado-adoptme.mjs --send           # + run importer
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'https://www.eldorado.gg'
const GAME_ID = '201' // Adopt Me on Eldorado
const CATEGORY = 'CustomItem'
const DEFAULT_OUTPUT = 'data/adopt-me-feeds/eldorado-cash-latest.json'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const COLLECTOR_VERSION = 1

/**
 * VARIANT DETECTION — title-driven, not trait-driven.
 *
 * The Eldorado "Traits" field is unreliable: sellers dump FR/Neon listings and
 * toys into the "None" bucket, so trait=None does NOT mean Normal. We only
 * trust a variant when the LISTING TITLE explicitly states it, and (when a
 * trait is present) the two agree. A listing whose variant can't be confirmed
 * from its own title is dropped — better to show "no reliable listings" than a
 * fabricated price. Plain Normal legendaries barely trade, so N will often have
 * no confirmable listings, which is the honest outcome.
 */

// Toys / non-pet items named after a pet, and bundles — reject outright.
// (plural "duckies" included — it slipped through before.)
const TOY_WORDS = /(duck(y|ies)|skateboard|sabre|saber|stroller|plush|\btoy\b|kingdom|castle|\bmap\b|\bbase\b|house|home|split|theme|bundle|pack|set|potion|egg|account|\bacc\b|robux)/

/**
 * Infer the variant from a listing title. Order matters: check the most
 * specific (MFR/NFR) before the generic (FR/N). Returns null when the title
 * gives no clear variant signal — we do NOT guess.
 */
function variantFromTitle(title) {
  const t = ` ${String(title).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `
  const has = (re) => re.test(t)
  // Most specific first.
  if (has(/\bmfr\b/) || has(/\bmega fly ride\b/) || has(/\bmega neon fly ride\b/)) return 'MFR'
  if (has(/\bnfr\b/) || has(/\bneon fly ride\b/)) return 'NFR'
  if (has(/\bmega neon\b/) || (has(/\bmega\b/) && !has(/\bfr\b|fly ride/))) return 'MEGA'
  if (has(/\bneon\b/) && !has(/\bfr\b|fly ride|fly|ride/)) return 'NEON'
  if (has(/\bfr\b/) || has(/\bfly ride\b/)) return 'FR'
  if (has(/\bfly\b/) && !has(/\bride\b/)) return 'F'
  if (has(/\bride\b/) && !has(/\bfly\b/)) return 'R'
  // Explicit Normal, OR the title is essentially just the pet name (handled by
  // the caller, which knows the pet name) — return 'N' only on an explicit word.
  if (has(/\bnormal\b/) || has(/\bno potion\b/) || has(/\bdefault\b/)) return 'N'
  return null
}

// Variants we are willing to publish as OBSERVED. NEON/MEGA plain forms were
// previously excluded because their TITLES are easily confused with NFR/MFR —
// but the structured Traits attribute distinguishes them unambiguously, so with
// trait-primary detection they are safe to include. (A NEON/MEGA that comes ONLY
// from a title, with no trait, is still risky, but the trait-first path means a
// title-only NEON/MEGA is rare.) The full 8-form ladder is now publishable.
const PUBLISHABLE_VARIANTS = new Set([
  'N',
  'F',
  'R',
  'FR',
  'NEON',
  'NFR',
  'MEGA',
  'MFR',
])

// Eldorado's structured "Traits" attribute is the PRIMARY variant source — it
// is more reliable than parsing emoji-filled titles. Map its codes to our
// 8-form ladder. The combo forms Eldorado also tracks (NR=Neon Ride, MF=Mega
// Fly, MR=Mega Ride, NF=Neon Fly) and bare M have NO column/UI in our ladder,
// so they are intentionally absent here → such listings fall through to the
// title, and are skipped if the title gives no publishable variant either.
//   N   Normal        F  Fly          R  Ride         FR  Fly Ride
//   NEON Neon         MEGA Mega Neon  NFR Neon Fly Ride   MFR Mega Fly Ride
const TRAIT_TO_VARIANT = {
  N: 'N',
  F: 'F',
  R: 'R',
  FR: 'FR',
  NEON: 'NEON',
  NFR: 'NFR',
  MEGA: 'MEGA',
  MFR: 'MFR',
}

/** Map an Eldorado trait code to our variant, or null if unmapped/None. */
function variantFromTrait(trait) {
  if (!trait) return null
  const key = String(trait).trim().toUpperCase()
  if (key === 'NONE') return null
  return TRAIT_TO_VARIANT[key] ?? null
}

function loadEnv() {
  // No-op when .env.local is absent (CI uses GitHub-secret env vars).
  let raw
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return
    throw err
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function parseArgs(argv) {
  const o = {
    send: false,
    limit: Number(process.env.ELDORADO_AM_LIMIT ?? 0),
    maxPages: Number(process.env.ELDORADO_AM_MAX_PAGES ?? 3),
    delayMs: Number(process.env.ELDORADO_AM_DELAY_MS ?? 1500),
    outputPath: DEFAULT_OUTPUT,
    slugs: null, // comma-separated slugs to target a subset
    onlyPublished: false, // only pets with a live page (has_page)
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--send') o.send = true
    else if (a === '--only-published') o.onlyPublished = true
    else if (a === '--limit') o.limit = Number(argv[++i])
    else if (a === '--max-pages') o.maxPages = Number(argv[++i])
    else if (a === '--delay-ms') o.delayMs = Number(argv[++i])
    else if (a === '--output') o.outputPath = argv[++i]
    else if (a === '--slugs') o.slugs = argv[++i].split(',').map((s) => s.trim())
  }
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function offersUrl(searchQuery, pageIndex) {
  const u = new URL('/api/v1/item-management/offers', BASE_URL)
  u.searchParams.set('gameId', GAME_ID)
  u.searchParams.set('category', CATEGORY)
  u.searchParams.set('searchQuery', searchQuery)
  u.searchParams.set('pageIndex', String(pageIndex))
  u.searchParams.set('pageSize', '50')
  u.searchParams.set('includeDeliveryMedians', 'true')
  return u.toString()
}

async function fetchOffers(searchQuery, pageIndex) {
  const res = await fetch(offersUrl(searchQuery, pageIndex), {
    headers: { 'user-agent': UA, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`offers ${searchQuery} p${pageIndex} → ${res.status}`)
  return res.json()
}

/** Normalise a title/name for exact matching (strip emoji, punctuation, case). */
function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Does this offer title refer to exactly THIS pet (not a "…Ducky" variant or a
 * bundle)? We require the pet name to appear and the leftover words to be only
 * trait tokens — this rejects "Shadow Dragon Ducky" while accepting
 * "FR Shadow Dragon" and "💜 Shadow Dragon 💜".
 */
function titleMatchesPet(title, petName) {
  const nt = normalizeName(title)
  const np = normalizeName(petName)
  if (!nt.includes(np)) return false
  // A toy/bundle named after the pet ("Shadow Dragon Ducky") is NOT the pet.
  if (TOY_WORDS.test(nt)) return false
  // After removing the pet name, only trait/adjective filler may remain. Any
  // leftover word that isn't a known modifier means it's a different item
  // (another pet in a bundle, a described variant we can't trust, etc.).
  const leftover = nt
    .replace(np, ' ')
    .split(' ')
    .filter(Boolean)
    .filter(
      (w) =>
        !/^(fr|nfr|mfr|nf|nr|mf|mr|n|f|r|m|none|neon|fly|ride|mega|adopt|me|pet|pets|the|a|an|for|sale|cheap|fast|op|instant|delivery|trusted|seller|online|ultra|rare|common|legendary|normal|24|7|to|and)$/.test(
          w,
        ),
    )
  return leftover.length === 0
}

function traitValue(offer) {
  const attrs = offer?.offerAttributeIdValues || []
  const t = attrs.find((a) => a.name === 'Traits')
  return t?.value ?? null
}

// Scam-bait titles ("add me / you need to add / friend request") — a few-cent
// "friend me in-game" listing, not a real sale. Eldorado's cheap fakes almost
// all carry one of these.
const SCAM_WORDS =
  /(you need add|you need to add|need to add|\badd me\b|add first|friend request|friend me|need friend|dm me|message me first|read desc|read description|not real|fake price)/i

// Minimum seller account age. The $0.67 scam listings are all brand-new (2026)
// accounts; the real high-value sellers are 2019-2022. Drop very new accounts.
const MIN_ACCOUNT_AGE_DAYS = Number(process.env.ELDORADO_MIN_ACCOUNT_DAYS ?? 120)

/** Account age in days from an ISO createdDate, or null if unknown. */
function accountAgeDays(createdDateIso, nowMs) {
  if (!createdDateIso) return null
  const created = Date.parse(createdDateIso)
  if (!Number.isFinite(created)) return null
  return (nowMs - created) / 86400000
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log('Adopt Me cash collector — Eldorado (gameId 201)')
  console.log(`  limit=${opts.limit || 'all'} maxPages=${opts.maxPages} delay=${opts.delayMs}ms\n`)

  // Which pets to price — from our catalog.
  let query = sb.from('adopt_me_pets').select('slug,name').eq('is_active', true).order('name')
  if (opts.onlyPublished) query = query.eq('has_page', true)
  if (opts.slugs) query = query.in('slug', opts.slugs)
  const { data: pets, error } = await query
  if (error) throw new Error(`load pets: ${error.message}`)
  const targets = opts.limit > 0 ? pets.slice(0, opts.limit) : pets

  const listings = []
  let matched = 0
  let skipped = 0

  for (let i = 0; i < targets.length; i += 1) {
    const pet = targets[i]
    let petListings = 0
    try {
      for (let page = 1; page <= opts.maxPages; page += 1) {
        const body = await fetchOffers(pet.name, page)
        const results = body?.results ?? []
        const nowMs = Date.now()
        for (const item of results) {
          const offer = item.offer
          if (!offer) continue
          const title = offer.offerTitle
          if (!titleMatchesPet(title, pet.name)) {
            skipped++
            continue
          }
          // Scam-bait "add me in-game" listings are not real sales.
          if (SCAM_WORDS.test(String(title))) {
            skipped++
            continue
          }
          // Drop brand-new seller accounts — the cheap fakes are all new.
          const age = accountAgeDays(item.user?.createdDate, nowMs)
          if (age != null && age < MIN_ACCOUNT_AGE_DAYS) {
            skipped++
            continue
          }
          // Variant: TRAIT-PRIMARY, title fallback. Eldorado's structured Traits
          // attribute is the reliable source (titles are emoji soup); when it
          // gives an explicit, mapped variant we trust it. Only when the trait is
          // None/absent/unmapped (e.g. a combo form we don't model) do we fall
          // back to parsing the title. When BOTH exist and DISAGREE, we drop the
          // listing — a mislabeled item we can't trust either way.
          const trait = traitValue(offer)
          const traitVariant = variantFromTrait(trait)
          const titleVariant = variantFromTitle(title)

          let variant = traitVariant ?? titleVariant
          if (!variant || !PUBLISHABLE_VARIANTS.has(variant)) {
            skipped++
            continue
          }
          // Both present and conflicting → untrustworthy, drop.
          if (
            traitVariant &&
            titleVariant &&
            traitVariant !== titleVariant
          ) {
            skipped++
            continue
          }
          const price = Number(offer.pricePerUnit?.amount)
          const currency = offer.pricePerUnit?.currency
          if (!Number.isFinite(price) || price <= 0 || currency !== 'USD') {
            skipped++
            continue
          }
          // Capture seller id for dedup (identical seller+title+price copies).
          const sellerId = item.user?.id ?? null
          // Seller reputation — the signal the reputable-pricing model runs on.
          // userOrderInfo.ratingCount is the seller's total reviews/orders (the
          // "(4771)" shown on the site), populated only because the request sets
          // includeDeliveryMedians=true. This is what "reputable (100+)" gates on.
          const orderInfo = item.userOrderInfo ?? {}
          const reviews = Number.isFinite(orderInfo.ratingCount)
            ? orderInfo.ratingCount
            : null
          const sellerRating = Number.isFinite(orderInfo.feedbackScore)
            ? orderInfo.feedbackScore
            : null
          listings.push({
            slug: pet.slug,
            name: pet.name,
            variant,
            priceUsd: price,
            title,
            trait,
            sellerId,
            reviews,
            sellerRating,
            accountAgeDays: age != null ? Math.round(age) : null,
          })
          petListings++
          matched++
        }
        if (results.length < 50) break // last page
        await sleep(opts.delayMs)
      }
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ${petListings} clean listings`)
    } catch (err) {
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ERROR: ${err.message}`)
    }
    if (i < targets.length - 1) await sleep(opts.delayMs)
  }

  const feed = {
    source: 'eldorado',
    game_id: GAME_ID,
    collector_version: COLLECTOR_VERSION,
    collected_at: new Date().toISOString(),
    pet_count: targets.length,
    listing_count: listings.length,
    matched,
    skipped,
    listings,
  }

  const outPath = resolve(process.cwd(), opts.outputPath)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(feed, null, 2))
  console.log(`\nWrote ${listings.length} clean listings (${matched} matched / ${skipped} skipped) → ${opts.outputPath}`)

  if (opts.send) {
    console.log('\n--send: handing feed to the cash importer…')
    await new Promise((res, rej) => {
      const child = spawn('node', ['scripts/import-adoptme-cash.mjs', opts.outputPath, '--write'], { stdio: 'inherit' })
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`importer exited ${code}`))))
    })
  }
}

main().catch((err) => {
  console.error('\n❌ Collector failed:', err.message)
  process.exit(1)
})
