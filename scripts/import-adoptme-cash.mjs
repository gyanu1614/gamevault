/**
 * Cash importer — Eldorado/U7BUY listings feed -> adopt_me_market_raw_listings
 * ============================================================================
 * Adopt Me now prices on the SAME reputable-seller model as SAB: a value is
 * real only if 100+ review sellers offer it. That decision needs the PER-SELLER
 * review count, which only makes sense to evaluate over the whole catalog at
 * once — so this importer no longer prices inline. It does one job: dump every
 * clean listing (pet, variant, price, SELLER REVIEWS, source) into the raw
 * table. The unified correct-prices cron reads that table and computes the
 * reputable cheapest/average via the shared adapter.
 *
 * Why the split: the old inline pricing (IQR trim + cluster low-end) had no
 * notion of seller reputation, so a $0.67 zero-review bait counted the same as
 * a 4000-order seller. Moving pricing to the cron lets Adopt Me reuse the exact
 * engine SAB uses, and keeps one source of truth for "what's reputable".
 *
 * Dedup: identical (source, seller, variant, price) copies collapse to one row
 * (the unique constraint), so one seller spamming N identical listings counts
 * once. A re-crawl UPDATES matched rows and RETIRES (listing_status='ended')
 * rows for a pet+source that vanished this run — history is kept, not deleted.
 *
 *   node scripts/import-adoptme-cash.mjs [feed.json]          # dry run
 *   node scripts/import-adoptme-cash.mjs [feed.json] --write  # persist
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

// The cash feeds to pool. Any that exist are merged; each listing keeps its own
// source so the cron can weigh/label per marketplace.
const DEFAULT_FEEDS = [
  'data/adopt-me-feeds/eldorado-cash-latest.json',
  'data/adopt-me-feeds/u7buy-cash-latest.json',
]

function readFeedIfExists(path) {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
  } catch {
    return null
  }
}

function toReviews(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const explicit = args.filter((a) => !a.startsWith('--'))
  const feedPaths = explicit.length ? explicit : DEFAULT_FEEDS

  const feeds = feedPaths.map(readFeedIfExists).filter(Boolean)
  if (!feeds.length) {
    console.error('No cash feeds found. Run a collector first.')
    process.exit(1)
  }

  const totalListings = feeds.reduce(
    (n, f) => n + (f.listing_count ?? f.listings.length),
    0,
  )
  console.log(
    `Cash importer (raw) — pooling ${feeds.length} source(s): ${feeds
      .map((f) => `${f.source}(${f.listings.length})`)
      .join(', ')}`,
  )
  console.log(
    `  ${totalListings} listings total  ${write ? 'MODE: --write' : 'MODE: dry run'}\n`,
  )

  const { data: pets } = await sb.from('adopt_me_pets').select('id,slug')
  const idBySlug = new Map((pets ?? []).map((p) => [p.slug, p.id]))

  // Build the raw rows, deduping identical (source, seller, variant, price)
  // copies up front so the batch itself carries no duplicates (the unique
  // constraint would collapse them anyway, but a clean batch is clearer).
  const rows = []
  const seen = new Set()
  const withReviews = new Set() // (pet,variant) that have >=1 reputable-capable row
  let deduped = 0
  let skippedNoPet = 0
  let skippedVariant = 0
  // Which (pet_id, source) pairs this run observed — used to retire the rest.
  const seenPetSource = new Set()

  for (const feed of feeds) {
    const source = feed.source ?? 'eldorado'
    for (const l of feed.listings) {
      const petId = idBySlug.get(l.slug)
      if (!petId) {
        skippedNoPet++
        continue
      }
      if (!PUBLISHABLE_VARIANTS.has(l.variant)) {
        skippedVariant++
        continue
      }
      const price = Number(l.priceUsd)
      if (!Number.isFinite(price) || price <= 0) continue

      const sellerId = l.sellerId != null ? String(l.sellerId) : null
      const dedupKey = `${source}|${sellerId ?? '?'}|${l.variant}|${price}`
      if (seen.has(dedupKey)) {
        deduped++
        continue
      }
      seen.add(dedupKey)

      const reviews = toReviews(l.reviews)
      if (reviews != null) withReviews.add(`${l.slug}/${l.variant}`)

      seenPetSource.add(`${petId}|${source}`)
      rows.push({
        pet_id: petId,
        variant: l.variant,
        source,
        price_usd: Math.round(price * 100) / 100,
        reviews,
        seller_rating:
          l.sellerRating != null && Number.isFinite(Number(l.sellerRating))
            ? Number(l.sellerRating)
            : null,
        seller_id: sellerId,
        title: l.title ?? null,
        listing_status: 'active',
        collected_at: new Date().toISOString(),
        ended_at: null,
      })
    }
  }

  console.log(
    `  ${rows.length} raw rows (${deduped} dup, ${skippedNoPet} unknown pet, ${skippedVariant} bad variant)`,
  )
  console.log(
    `  ${withReviews.size} pet-variants have >=1 listing WITH a seller review count (reputable-capable)\n`,
  )

  if (!write) {
    // Show a small sample so a dry run is legible.
    for (const r of rows.slice(0, 15)) {
      const slug = [...idBySlug.entries()].find(([, id]) => id === r.pet_id)?.[0]
      console.log(
        `  dry ${String(slug).padEnd(22)} ${r.variant.padEnd(4)} $${r.price_usd}  reviews=${r.reviews ?? '—'}  ${r.source}`,
      )
    }
    if (rows.length > 15) console.log(`  … and ${rows.length - 15} more`)
    console.log('\nRe-run with --write to persist raw listings.')
    return
  }

  // Upsert in batches on the unique key so a re-crawl updates in place.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await sb
      .from('adopt_me_market_raw_listings')
      .upsert(batch, {
        onConflict: 'pet_id,variant,source,seller_id,price_usd',
      })
    if (error) {
      console.error(`  XX batch ${i}: ${error.message}`)
    } else {
      upserted += batch.length
    }
  }

  // Retire listings for a (pet, source) we DID crawl this run but no longer see:
  // mark them ended rather than deleting, so a vanished offer stops setting the
  // price but its history survives. Only touch pet+source pairs we actually
  // observed — never retire a source this run didn't cover.
  let retired = 0
  const cutoff = new Date(Date.now() - 60_000).toISOString() // rows not just written
  for (const petSource of seenPetSource) {
    const [petId, source] = petSource.split('|')
    const { data, error } = await sb
      .from('adopt_me_market_raw_listings')
      .update({ listing_status: 'ended', ended_at: new Date().toISOString() })
      .eq('pet_id', petId)
      .eq('source', source)
      .eq('listing_status', 'active')
      .lt('collected_at', cutoff)
      .select('id')
    if (error) console.error(`  retire ${petSource}: ${error.message}`)
    else retired += data?.length ?? 0
  }

  console.log(
    `\nWrote ${upserted} raw listings, retired ${retired} vanished. ` +
      `Pricing runs in the correct-prices cron (reputable engine).`,
  )
}

main().catch((err) => {
  console.error('\n❌ Cash importer failed:', err.message)
  process.exit(1)
})
