/**
 * The Discord post for a catalogue run. Only two runs speak: one that added
 * items (owner wants to see them) and one that stopped itself (someone must
 * look). Failures are posted by the workflow's failure step, which also
 * covers crashes and timeouts this code never sees.
 */
import type { CatalogueGame, RunReport } from './types'

const MAX_NAMES = 12

export function runMessage(game: CatalogueGame, report: RunReport, siteUrl: string): string | null {
  const title = `**${game.name}**`
  if (report.status === 'blocked') return `⚠️ ${title} catalogue run stopped: ${report.message}. Nothing was written.`
  const n = report.added.length
  if (!n) return null
  // <url> stops Discord from unfurling a preview card per link.
  const links = report.added.slice(0, MAX_NAMES).map((a) => `[${a.name}](<${siteUrl}/${game.adapter.gameSlug}/values/${a.slug}>)`)
  const more = n > MAX_NAMES ? ` and ${n - MAX_NAMES} more` : ''
  const noun = n === 1 ? game.adapter.label.replace(/s$/, '') : game.adapter.label
  return `🆕 ${title}: ${n} new ${noun} added: ${links.join(', ')}${more}.`
}
