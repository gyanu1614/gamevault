/**
 * Phase 1 · Step 1d — seeder merge rules.
 *
 * Pure and dependency-free, like validate-game.ts: scripts/seed-games.mjs is
 * a plain node process with no Next.js runtime, and these rules are the part
 * worth testing, so they live here rather than inline in the script.
 */

/** The columns the seeder writes. Loose by design — the script builds it. */
export interface SeededGameRow {
  name?: string | null
  slug?: string | null
  ecosystem?: string | null
  content_tier?: string | null
  source?: string | null
  description?: string | null
  image_url?: string | null
}

/** Whatever the database currently holds for that slug. */
export type ExistingGameRow = Partial<SeededGameRow> & Record<string, unknown>

/**
 * Columns that carry human-authored prose. The seeder may FILL these when
 * production is blank, but must never overwrite a non-empty value: someone
 * may have rewritten a description by hand, and a re-run should not silently
 * revert it to the templated CSV string.
 *
 * Everything else the seeder writes (ecosystem, content_tier, source,
 * image_url) is config rather than copy, and stays freely updatable.
 */
export const FILL_ONLY_COLUMNS = ['name', 'description', 'short_description'] as const

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/**
 * Merge one seeded row against what the database already holds, applying
 * fill-only semantics to FILL_ONLY_COLUMNS.
 *
 * Returns the row to write. Callers still diff it against `existing` to
 * decide whether an UPDATE is needed at all — a merge that changes nothing
 * must not touch the row, because the set_games_updated_at trigger would
 * bump updated_at and move the sitemap's <lastmod> for every game.
 */
export function mergeGameRow<T extends SeededGameRow>(
  seeded: T,
  existing: ExistingGameRow,
): T {
  const out = { ...seeded }
  for (const col of FILL_ONLY_COLUMNS) {
    if (!(col in out)) continue
    const current = (existing as Record<string, unknown>)[col]
    // Production holds real text → keep it, whatever the CSV says.
    if (!isBlank(current)) {
      ;(out as Record<string, unknown>)[col] = current
    }
  }
  return out
}

export interface AliasCollision {
  /** The row carrying the offending alias. */
  slug: string
  /** The alias that collides. */
  alias: string
  /** The other row's slug it collides with. */
  collidesWith: string
}

/**
 * Reject any row whose alias equals a DIFFERENT row's slug.
 *
 * An alias is meant to be an alternative name for the same game. When it is
 * also another row's canonical slug, the two rows describe the same game
 * under two identities — which is exactly the duplicate that had to be
 * filtered by hand during the Step 1 ship (`counter-strike-2` vs `cs2`).
 *
 * A row aliasing its own slug is harmless and allowed.
 */
export function findAliasSlugCollisions(
  rows: ReadonlyArray<{ slug: string; aliases?: readonly string[] | null }>,
): AliasCollision[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const bySlug = new Map(rows.map((r) => [norm(r.slug), r.slug]))
  const hits: AliasCollision[] = []

  for (const row of rows) {
    for (const rawAlias of row.aliases ?? []) {
      const alias = norm(rawAlias ?? '')
      if (!alias) continue
      if (alias === norm(row.slug)) continue // aliasing itself is fine
      const owner = bySlug.get(alias)
      if (owner !== undefined) {
        hits.push({ slug: row.slug, alias: rawAlias.trim(), collidesWith: owner })
      }
    }
  }
  return hits
}
