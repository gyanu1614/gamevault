/**
 * Step 7b — every listing mutation path revalidates the category surfaces.
 *
 * `/[gameSlug]/[categorySlug]` is prerendered with a 24 h TTL. The only thing
 * that keeps it honest is that each code path which changes what a category
 * page shows calls `revalidateListingSurfaces` (lib/revalidation/listings).
 * This guard finds those paths by what they WRITE, not by name, so a new
 * mutation cannot land without either calling the seam or being listed here
 * with a reason:
 *
 *   - a `.from('listings')` chain that inserts/updates/upserts/deletes
 *   - a moderation RPC (approve_listing / reject_listing / request_listing_changes)
 *   - a write to seller_presence.store_paused (hides every listing of a seller)
 *   - a write to instant_delivery_inventory (a trigger syncs listings.quantity)
 *   - an order → 'completed' transition, direct or via the safedrop_transition
 *     RPC seam (a trigger decrements listings.quantity)
 *
 * The set of writer files is pinned: adding one shows up in review.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

/** Writers that do not need to revalidate, with the reason. */
// View counters left the set on 2026-10-01: views are counted only through
// the service-role `increment_listing_views` RPC (lib/actions/listing-views),
// which bumps a sort key the nightly backstop covers — no revalidation needed.
const EXEMPT: Record<string, string> = {
  // Bundle 2: writes only the value_item_slug / value_variant /
  // value_matched_at link columns. Every caller revalidates right after it
  // (the create/edit paths, pinned by value-listings-link-seams.guard.test.ts,
  // and the nightly /api/cron/value-listing-refs).
  'src/lib/value-listings/link.ts': 'link columns only; its callers revalidate',
  // Step 4 — the shared create seam. It deliberately does NOT revalidate: the
  // caller does, so a 500-row import revalidates once per category instead of
  // once per listing. Every caller of it is itself in the pinned set below.
  'src/lib/listings/create.ts': 'the shared insert seam; its callers revalidate (and are pinned here)',
}

const SEAM = '@/lib/revalidation/listings'
/** Browser-side modules cannot call revalidateTag; they call the session-scoped action. */
const BROWSER_SEAM = '@/lib/actions/revalidate-listing-surfaces'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'test' || name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** The method chain that follows a `.from('<table>')` call, up to the next
 *  statement boundary or the next `.from(` (a different query). */
function chainsFor(source: string, table: string): string[] {
  const chains: string[] = []
  const re = new RegExp(`\\.from\\('${table}'\\)`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const rest = source.slice(m.index + m[0].length)
    const end = rest.search(/\.from\(|;\n|\n\s*\n|\bawait\b|\breturn\b/)
    chains.push(end === -1 ? rest : rest.slice(0, end))
  }
  return chains
}

// `.update(` and the cast style `.update as any)(` both count.
const WRITE = /\.(insert|update|upsert|delete)\b/

export function isListingMutationFile(source: string): string[] {
  const reasons: string[] = []
  if (chainsFor(source, 'listings').some((c) => WRITE.test(c))) reasons.push('writes listings')
  if (/rpc[^'"]{0,30}\(\s*'(approve_listing|reject_listing|request_listing_changes)'/.test(source)) reasons.push('moderation rpc')
  if (
    chainsFor(source, 'seller_presence').some((c) => WRITE.test(c)) &&
    /store_paused/.test(source)
  ) reasons.push('writes seller_presence.store_paused')
  if (chainsFor(source, 'instant_delivery_inventory').some((c) => WRITE.test(c))) reasons.push('writes instant_delivery_inventory')
  if (
    chainsFor(source, 'orders').some((c) => WRITE.test(c) && /status:\s*'completed'/.test(c)) ||
    /rpc[^'"]{0,30}\(\s*'safedrop_transition'/.test(source)
  ) reasons.push('completes orders (trigger decrements stock)')
  return reasons
}

const files = walk(SRC)
const writers = files
  .map((f) => ({ file: relative(ROOT, f).split(sep).join('/'), source: readFileSync(f, 'utf8') }))
  .map((x) => ({ ...x, reasons: isListingMutationFile(x.source) }))
  .filter((x) => x.reasons.length > 0)

describe('listing mutations revalidate the category surfaces', () => {
  it('finds the mutation paths (guards a vacuous pass)', () => {
    expect(writers.map((w) => w.file)).toContain('src/lib/actions/sell-wizard.ts')
    expect(writers.map((w) => w.file)).toContain('src/lib/actions/moderation.ts')
  })

  it('every mutation path calls revalidateListingSurfaces or is exempt with a reason', () => {
    const missing = writers
      .filter((w) => !(w.file in EXEMPT))
      .filter(
        (w) =>
          !(
            (w.source.includes(SEAM) && /revalidateListingSurfaces\(/.test(w.source)) ||
            (w.source.includes(BROWSER_SEAM) && /revalidateMyListingSurfaces\(/.test(w.source))
          ),
      )
      .map((w) => `${w.file}  (${w.reasons.join(', ')})`)
    expect(missing, `\n${missing.join('\n')}\n`).toEqual([])
  })

  it('exemptions still write (a stale exemption must be removed)', () => {
    for (const file of Object.keys(EXEMPT)) {
      expect(writers.map((w) => w.file), `${file} no longer mutates listings`).toContain(file)
    }
  })

  it('pins the set of mutation paths', () => {
    expect(writers.map((w) => w.file).sort()).toEqual([
      // Step 4 — the bulk importer. Writes through @/lib/listings/create and
      // revalidates once per category per applied chunk.
      'src/lib/actions/admin-imports.ts',
      // Moderation tools (2026-10-09): takedown / restore / image removal /
      // strike escalation — every path calls the seam.
      'src/lib/actions/admin-moderation-tools.ts',
      'src/lib/actions/admin-seller-restrictions.ts',
      'src/lib/actions/instant-delivery.ts',
      'src/lib/actions/listings.ts',
      'src/lib/actions/moderation.ts',
      // orders.ts left the set with createOrder (fee engine PR 3, A9): the
      // live path is createCheckout → transition(), pinned below.
      'src/lib/actions/sell-wizard.ts',
      'src/lib/actions/seller-presence.ts',
      'src/lib/api/seller-compatible.ts',
      'src/lib/escrow/transition.ts',
      // Step 4: the shared insert seam (exempt from calling the seam itself —
      // see EXEMPT above — but still a writer, so it is pinned here).
      'src/lib/listings/create.ts',
      // GRO-08: drafts built during the application are submitted on
      // approval (service role) — calls the seam per touched listing.
      'src/lib/listings/submit-applicant-drafts.ts',
      // Bundle 2: the value item link (exempt above; callers revalidate).
      'src/lib/value-listings/link.ts',
    ])
  })
})
