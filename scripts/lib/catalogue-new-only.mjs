/**
 * Scheduled catalogue runs ADD rows only (2026-10-14). A full upsert rewrites
 * every row's is_enabled / sort_order, so an item an admin switched off would
 * come back on every week. Plain JS: loaded by tsx scripts and by vitest.
 */

/**
 * @param {{ slug: string }[]} items        the freshly built catalogue
 * @param {{ slug: string, sort_order: number | null }[]} existing  rows already in the DB
 * @returns {{ fresh: any[], startOrder: number }}
 */
export function newOnlyPlan(items, existing) {
  const have = new Set(existing.map((r) => r.slug))
  const last = existing.reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1)
  return { fresh: items.filter((i) => !have.has(i.slug)), startOrder: last + 1 }
}

/**
 * A GitHub job-summary block: heading with the count, then up to `cap` names.
 * @param {string} title
 * @param {string[]} names
 */
export function catalogueGapSummary(title, names, cap = 30) {
  if (!names.length) return `### ${title} (0)\nNone found.\n`
  const shown = names.slice(0, cap).map((n) => `- ${n}`)
  const more = names.length > cap ? [`…and ${names.length - cap} more`] : []
  return [`### ${title} (${names.length})`, ...shown, ...more, ''].join('\n')
}
