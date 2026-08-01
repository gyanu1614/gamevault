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
 * Usage:
 *   node scripts/import-adoptmevalues.mjs [feed.json]         # dry run (default)
 *   node scripts/import-adoptmevalues.mjs [feed.json] --write # actually upsert
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

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const feedPath = resolve(
    process.cwd(),
    args.find((a) => !a.startsWith('--')) ?? 'data/adopt-me-feeds/adoptmevalues-latest.json',
  )

  const feed = JSON.parse(readFileSync(feedPath, 'utf8'))
  console.log(`Importer — ${feed.pets.length} pets from ${feed.source} (${feed.collected_at})`)
  console.log(write ? '  MODE: --write (upserting)\n' : '  MODE: dry run (pass --write to persist)\n')

  let inserted = 0
  let updated = 0
  let valueRows = 0

  for (const pet of feed.pets) {
    // --- upsert the pet row (by slug) ---
    const petPayload = {
      slug: pet.slug,
      name: pet.name,
      rarity: pet.rarity,
      obtainability: KNOWN_OBTAINABILITY[pet.slug] ?? pet.obtainability ?? 'obtainable',
      image_url: pet.image_url,
      // demand_rank deliberately omitted — the source's rank is a
      // position-within-rarity artifact, not real demand (see note above).
      demand_trend: 'stable',
      // Active = has data and can appear on the value list. Description (and
      // therefore has_page) is added later in TASK-3.
      is_active: true,
    }

    if (!write) {
      console.log(`  [dry] ${pet.name} (${pet.rarity}) + ${ALL_VARIANTS.length} variant rows`)
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

    // --- upsert the 8 variant value rows (by pet_id + variant) ---
    const rows = buildVariantRows(upserted.id, pet.trade_values).map((r) => ({
      ...r,
      pet_id: upserted.id,
    }))
    const { error: valErr } = await sb
      .from('adopt_me_pet_values')
      .upsert(rows, { onConflict: 'pet_id,variant' })

    if (valErr) {
      console.error(`  ❌ ${pet.name} values: ${valErr.message}`)
    } else {
      valueRows += rows.length
      console.log(`  ✅ ${pet.name} (${pet.rarity}) — ${rows.length} variants`)
    }
  }

  console.log(`\n${write ? 'Upserted' : 'Would upsert'}: ${inserted} new pets, ${updated} updated, ${valueRows} value rows`)
  if (!write) console.log('Re-run with --write to persist.')
}

main().catch((err) => {
  console.error('\n❌ Importer failed:', err.message)
  process.exit(1)
})
