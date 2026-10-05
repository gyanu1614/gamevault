/**
 * Importer — adoptmevalues feed → adopt_me_pets + adopt_me_pet_values
 * ============================================================================
 * Reads the JSON written by collect-adoptmevalues.mjs and UPSERTS it. Designed
 * to be run repeatedly: the first seed and every weekly refresh use the same
 * code path, so a newly-released pet is inserted and an existing pet is updated
 * in place — never duplicated. Upsert key: adopt_me_pets.slug.
 *
 * WHAT IT WRITES
 *   adopt_me_pets        — one row per pet (upsert by slug)
 *   adopt_me_pet_values  — 8 variant rows per pet (upsert by pet_id+variant):
 *       N, NEON, MEGA           → trade_value from the source (published)
 *       F, R, FR, NFR, MFR      → trade_value DERIVED from the potion ladder,
 *                                 is_estimated=true (source doesn't publish them)
 *   cash_value_usd stays NULL — USD comes from the marketplace collectors later.
 *
 * Pets are set is_active=true once they carry values, so the value LIST can
 * show them. The per-pet PAGE stays gated behind has_page (needs a description).
 *
 * NEW-PET GATE (owner rule 2026-10-04): a pet is listed only when one of its
 * variants has a real reputable cash price above $1. The feed now carries the
 * WHOLE catalog (~791 pets), so this importer never adds a pet that is not
 * already in adopt_me_pets unless it is approved:
 *   --qualifying <report.json>  add new pets the dry-run report marks qualifies
 *                               (scripts/adoptme-catalog-dryrun.mjs)
 *   --allow-new                 add every new pet in the feed (explicit opt-in)
 * Existing pets are refreshed exactly as before, so the weekly catalog job
 * keeps working and cannot flood the catalog.
 *
 * Usage:
 *   node scripts/import-adoptmevalues.mjs [feed.json]         # dry run (default)
 *   node scripts/import-adoptmevalues.mjs [feed.json] --write # actually upsert
 *   node scripts/import-adoptmevalues.mjs [feed.json] --qualifying data/adopt-me-catalog-dryrun/<date>.json [--write]
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// --- env (minimal loader, matches the SAB scripts) --------------------------
// Reads .env.local locally, but is a NO-OP when the file is absent (CI, where
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY come from GitHub secrets
// via the workflow env). Missing file must never crash the importer.
function loadEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return // no local env file — use process.env
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

// --- the potion / Neon ladder ----------------------------------------------
// Adopt Me trade values follow a well-known progression off the Normal (N)
// value. The source publishes only N, NEON and MEGA; the other five are
// derived from these anchors. Ratios are the community-standard rough premiums
// (Fly and Ride are near-identical; FR is the benchmark; NFR/MFR sit above
// their un-potioned Neon/Mega). Every derived row is flagged is_estimated=true
// so the UI never presents a derived number as observed.
//
// Derivation, given N, NEON, MEGA from the source:
//   F   ≈ N   * 1.15
//   R   ≈ N   * 1.15
//   FR  ≈ N   * 1.45          (the standard trading benchmark)
//   NFR ≈ NEON * 1.35
//   MFR ≈ MEGA * 1.25
const DERIVED = {
  F: { from: 'N', mult: 1.15 },
  R: { from: 'N', mult: 1.15 },
  FR: { from: 'N', mult: 1.45 },
  NFR: { from: 'NEON', mult: 1.35 },
  MFR: { from: 'MEGA', mult: 1.25 },
}
const PUBLISHED_VARIANTS = ['N', 'NEON', 'MEGA']
const ALL_VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR']

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100
}

// Obtainability isn't reliably published per-pet on the source, and the
// "demand_rank" the list exposes is really a position-within-rarity artifact
// (every rarity runs 1..N), not a true demand signal — so we do NOT import it.
// For obtainability we override the well-known retired/limited legendaries
// (facts from the brief) and default everything else to 'obtainable'. Wrong
// obtainability on a marquee pet is worse than none, so these are curated.
const KNOWN_OBTAINABILITY = {
  'shadow-dragon': 'unobtainable',
  'frost-dragon': 'unobtainable',
  'bat-dragon': 'unobtainable',
  'giraffe': 'unobtainable',
  'evil-unicorn': 'unobtainable',
  'parrot': 'unobtainable',
  'crow': 'unobtainable',
  'owl': 'unobtainable',
  'turtle': 'unobtainable',
  'kangaroo': 'unobtainable',
  'arctic-reindeer': 'unobtainable',
  'blue-dog': 'unobtainable',
  'pink-cat': 'unobtainable',
}

/** Build all 8 variant rows for a pet from its published trade values. */
function buildVariantRows(petId, tradeValues) {
  const rows = []
  for (const variant of ALL_VARIANTS) {
    let tradeValue = null
    let isEstimated = true

    if (PUBLISHED_VARIANTS.includes(variant)) {
      tradeValue = tradeValues[variant] ?? null
      // Published trade value is "observed" community consensus. Still no USD,
      // but the trade number itself is from the source, not derived.
      isEstimated = tradeValue == null
    } else {
      const rule = DERIVED[variant]
      const anchor = tradeValues[rule.from]
      if (anchor != null) tradeValue = Math.round(anchor * rule.mult)
      isEstimated = true
    }

    rows.push({
      variant,
      trade_value: tradeValue,
      cash_value_usd: null, // filled by marketplace collectors later
      listings_tracked: 0, // no observed sales yet
      confidence: 'low', // will be recomputed by adopt_me_confidence_for once priced
      is_estimated: isEstimated,
      last_priced_at: null,
    })
  }
  return rows
}

/** Every adopt_me_pets slug, paged (PostgREST caps one response at 1000 rows). */
async function existingSlugs() {
  const slugs = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('adopt_me_pets')
      .select('id,slug')
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`load existing pets: ${error.message}`)
    for (const r of data ?? []) slugs.add(r.slug)
    if (!data || data.length < 1000) break
  }
  return slugs
}

function parseArgs(argv) {
  const o = { write: false, allowNew: false, qualifying: null, feed: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--write') o.write = true
    else if (a === '--allow-new') o.allowNew = true
    else if (a === '--qualifying') o.qualifying = argv[++i]
    else if (!a.startsWith('--') && !o.feed) o.feed = a
  }
  return o
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const write = opts.write
  const feedPath = resolve(process.cwd(), opts.feed ?? 'data/adopt-me-feeds/adoptmevalues-latest.json')

  const feed = JSON.parse(readFileSync(feedPath, 'utf8'))
  console.log(`Importer — ${feed.pets.length} pets from ${feed.source} (${feed.collected_at})`)
  console.log(write ? '  MODE: --write (upserting)\n' : '  MODE: dry run (pass --write to persist)\n')

  // New-pet gate: which slugs may be ADDED (existing ones are always refreshed).
  const known = await existingSlugs()
  let approvedNew = null // null = none approved
  if (opts.qualifying) {
    const report = JSON.parse(readFileSync(resolve(process.cwd(), opts.qualifying), 'utf8'))
    approvedNew = new Set((report.pets ?? []).filter((p) => p.qualifies).map((p) => p.slug))
  }
  const pets = feed.pets.filter((p) => {
    if (known.has(p.slug)) return true
    if (opts.allowNew) return true
    return approvedNew?.has(p.slug) ?? false
  })
  const gated = feed.pets.length - pets.length
  console.log(
    `  ${known.size} pets already in the DB; ${pets.length} to import ` +
      `(${pets.filter((p) => !known.has(p.slug)).length} new), ${gated} new pets held back by the gate` +
      (opts.allowNew ? ' (--allow-new)' : opts.qualifying ? ` (--qualifying ${opts.qualifying})` : ' (no --qualifying)') +
      '\n',
  )

  let inserted = 0
  let updated = 0
  let valueRows = 0

  for (const pet of pets) {
    // --- upsert the pet row (by slug) ---
    // Obtainability: curated override, else the enriched value. An existing pet
    // with no enriched value keeps what it has (an un-enriched refresh used to
    // reset every pet to 'obtainable').
    const obtainability =
      KNOWN_OBTAINABILITY[pet.slug] ??
      pet.obtainability ??
      (known.has(pet.slug) ? undefined : 'obtainable')
    const petPayload = {
      slug: pet.slug,
      name: pet.name,
      rarity: pet.rarity,
      ...(obtainability ? { obtainability } : {}),
      image_url: pet.image_url,
      // demand_rank deliberately omitted — the source's rank is a
      // position-within-rarity artifact, not real demand (see note above).
      demand_trend: 'stable',
      // Active = has data and can appear on the value list. Description (and
      // therefore has_page) is added later in TASK-3.
      is_active: true,
    }

    if (!write) {
      console.log(
        `  [dry] ${known.has(pet.slug) ? 'refresh' : 'NEW    '} ${pet.name} (${pet.rarity}) + ${ALL_VARIANTS.length} variant rows`,
      )
      valueRows += ALL_VARIANTS.length
      continue
    }

    // Was it already there? (to report insert vs update)
    const { data: existing } = await sb
      .from('adopt_me_pets')
      .select('id')
      .eq('slug', pet.slug)
      .maybeSingle()

    const { data: upserted, error: petErr } = await sb
      .from('adopt_me_pets')
      .upsert(petPayload, { onConflict: 'slug' })
      .select('id')
      .single()

    if (petErr) {
      console.error(`  ❌ ${pet.name}: ${petErr.message}`)
      continue
    }
    existing ? updated++ : inserted++

    // --- write the 8 variant value rows (by pet_id + variant) ---
    // CRITICAL: this catalog importer owns ONLY the trade columns. The USD cash
    // columns (cash_value_usd, listings_tracked, confidence, last_priced_at) are
    // owned by the marketplace cash pipeline (import-adoptme-cash.mjs). A blind
    // upsert here would blank real cash on every catalog refresh — so we INSERT
    // brand-new variant rows in full (cash correctly NULL) but only UPDATE the
    // TRADE columns on rows that already exist, leaving their cash untouched.
    const built = buildVariantRows(upserted.id, pet.trade_values).map((r) => ({
      ...r,
      pet_id: upserted.id,
    }))

    // Which (pet_id, variant) rows already exist?
    const { data: existingVariants, error: exErr } = await sb
      .from('adopt_me_pet_values')
      .select('variant')
      .eq('pet_id', upserted.id)
    if (exErr) {
      console.error(`  ❌ ${pet.name} values (lookup): ${exErr.message}`)
      continue
    }
    const have = new Set((existingVariants ?? []).map((r) => r.variant))

    const toInsert = built.filter((r) => !have.has(r.variant))
    const toUpdate = built.filter((r) => have.has(r.variant))

    let valErr = null
    // New rows: insert in full (their cash is legitimately NULL).
    if (toInsert.length > 0) {
      const { error } = await sb.from('adopt_me_pet_values').insert(toInsert)
      valErr = valErr || error
    }
    // Existing rows: touch ONLY trade_value. is_estimated belongs to the cash
    // pipeline too (the reprice sets it false on a real price) — writing it
    // here flipped every priced row back to "estimated" until the next reprice.
    for (const r of toUpdate) {
      const { error } = await sb
        .from('adopt_me_pet_values')
        .update({ trade_value: r.trade_value })
        .eq('pet_id', upserted.id)
        .eq('variant', r.variant)
      valErr = valErr || error
    }

    if (valErr) {
      console.error(`  ❌ ${pet.name} values: ${valErr.message}`)
    } else {
      valueRows += built.length
      console.log(
        `  ✅ ${pet.name} (${pet.rarity}) — ${toInsert.length} new, ${toUpdate.length} trade-updated`,
      )
    }
  }

  console.log(`\n${write ? 'Upserted' : 'Would upsert'}: ${inserted} new pets, ${updated} updated, ${valueRows} value rows`)
  if (!write) console.log('Re-run with --write to persist.')
}

main().catch((err) => {
  console.error('\n❌ Importer failed:', err.message)
  process.exit(1)
})
