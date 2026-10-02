/**
 * Search Analytics + sitemap status report (read-only).
 *
 *   pnpm gsc:search-report
 *
 * Last 28 and 90 days: totals, top 100 queries and pages, by country and device,
 * queries at average position 4–20, plus the submitted sitemaps' status.
 * Writes CSVs and search-summary-YYYY-MM-DD.md to docs/audit/gsc/.
 * Auth: service-account key at $GOOGLE_APPLICATION_CREDENTIALS or ~/.config/gsc/key.json.
 * See docs/gsc-reports.md.
 */

import { homedir } from 'node:os'
import { parseArgs } from 'node:util'

import { DEFAULT_OUT_DIR } from './lib/gsc/config'
import { createRuntime, localDate } from './lib/gsc/runtime'
import { runSearchReport } from './lib/gsc/search-report'
import { realClock } from './lib/gsc/types'

const HELP = `Usage: pnpm gsc:search-report [options]
  --date <YYYY-MM-DD>   file date and the day the windows are measured from (default: today, local)
  --out-dir <dir>       output directory (default ${DEFAULT_OUT_DIR})`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' },
      'out-dir': { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(HELP)
    return 0
  }
  const date = values.date ?? localDate(new Date())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date must be YYYY-MM-DD')

  const { client, keyPath } = createRuntime({ env: process.env, home: homedir(), fetch, clock: realClock })
  console.log(`Using service-account key at ${keyPath}`)

  const result = await runSearchReport({ outDir: values['out-dir'] ?? DEFAULT_OUT_DIR, date }, { client })
  console.log(`Wrote ${result.files.length} files`)
  console.log(`Summary: ${result.summaryPath}`)
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`gsc:search-report failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  },
)
