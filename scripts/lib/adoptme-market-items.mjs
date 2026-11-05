/**
 * Adopt Me eggs and potions as catalogue rows, from a checked picture report.
 * Pure parts, so the rules are unit tests. See scripts/adoptme-market-items.mjs.
 */
import { createHash } from 'node:crypto'

/** Rows the market catalogue sells and the Values pages, calculator, sitemap and blog (all is_active readers) never see. */
export const MARKET_ROW_DEFAULTS = {
  is_active: false,
  // Required by the column's NOT NULL + CHECK; the market catalogue drops it for eggs and potions, so nothing shows it.
  rarity: 'common',
}

export const marketImagePath = (slug) => `market/${slug}.webp`

/**
 * What a run would do: each report row's checked picture, or why it was left
 * out. A row already in the catalogue is skipped (insert-only: an edit made since
 * wins). A picture that isn't the one reviewed stops the whole run.
 * @param {{ rows: Array<{ slug: string, name: string, kind: string, out_file: string, out_sha256: string }> }} report
 * @param {Set<string>} existingSlugs
 * @param {(outFile: string) => Buffer} readPicture
 */
export function planMarketItems(report, existingSlugs, readPicture) {
  const rows = []
  const skipped = []
  for (const r of report.rows) {
    if (r.kind !== 'egg' && r.kind !== 'potion') throw new Error(`${r.slug}: kind "${r.kind}" is not egg or potion`)
    if (existingSlugs.has(r.slug)) {
      skipped.push(r.slug)
      continue
    }
    const bytes = readPicture(r.out_file)
    const sha = createHash('sha256').update(bytes).digest('hex')
    if (sha !== r.out_sha256) throw new Error(`${r.slug}: picture changed since it was reviewed (${r.out_file})`)
    rows.push({ slug: r.slug, name: r.name, kind: r.kind, bytes })
  }
  return { rows, skipped }
}

/** The insert for one planned row, once its picture is uploaded. */
export function marketRow(row, publicPrefix) {
  return { ...MARKET_ROW_DEFAULTS, slug: row.slug, name: row.name, item_kind: row.kind, image_url: publicPrefix + marketImagePath(row.slug) }
}
