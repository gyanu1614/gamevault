/**
 * URL Inspection index report for every sitemap URL (read-only).
 *
 *   pnpm gsc:index-report
 *   pnpm gsc:index-report --extra-urls urls.txt --limit 25
 *
 * Writes docs/audit/gsc/index-report-YYYY-MM-DD.csv + index-summary-YYYY-MM-DD.md.
 * Resumable: a rerun the same day skips URLs already in the CSV.
 * Auth: service-account key at $GOOGLE_APPLICATION_CREDENTIALS or ~/.config/gsc/key.json.
 * See docs/gsc-reports.md.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { parseArgs } from 'node:util'

import { DEFAULT_OUT_DIR, SITEMAP_URL } from './lib/gsc/config'
import { runIndexReport } from './lib/gsc/index-report'
import { createRuntime, localDate } from './lib/gsc/runtime'
import { collectSitemapUrls, parseExtraUrls } from './lib/gsc/sitemap'
import { realClock } from './lib/gsc/types'

const HELP = `Usage: pnpm gsc:index-report [options]
  --extra-urls <file>   extra URLs to inspect (one per line; # comments; /paths ok)
  --limit <n>           inspect at most n not-yet-saved URLs this run
  --concurrency <n>     parallel inspections (default 16; pacing stays at 4 req/s)
  --date <YYYY-MM-DD>   file date (default: today, local)
  --out-dir <dir>       output directory (default ${DEFAULT_OUT_DIR})`

function intOption(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`)
  return n
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'extra-urls': { type: 'string' },
      limit: { type: 'string' },
      concurrency: { type: 'string' },
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

  const urls = await collectSitemapUrls(SITEMAP_URL, fetch)
  console.log(`Sitemap: ${urls.length} URLs`)
  if (values['extra-urls']) {
    const extra = parseExtraUrls(readFileSync(values['extra-urls'], 'utf8'))
    console.log(`Extra URLs: ${extra.length}`)
    urls.push(...extra)
  }

  const { client, keyPath } = createRuntime({ env: process.env, home: homedir(), fetch, clock: realClock })
  console.log(`Using service-account key at ${keyPath}`)

  const result = await runIndexReport(
    {
      urls,
      outDir: values['out-dir'] ?? DEFAULT_OUT_DIR,
      date,
      concurrency: intOption('concurrency', values.concurrency),
      limit: intOption('limit', values.limit),
    },
    { client },
  )

  console.log('')
  console.log(`Inspected ${result.inspected} · already saved ${result.skipped} · failed ${result.failed.length} · remaining ${result.remaining}`)
  console.log(`CSV:     ${result.csvPath}`)
  console.log(`Summary: ${result.summaryPath}`)
  if (result.stoppedOnQuota) console.log('Stopped on the daily quota — rerun tomorrow to finish.')
  if (result.abortedOnErrors) console.log('Aborted after repeated failures — see FAILED lines above.')
  return result.remaining > 0 ? 2 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`gsc:index-report failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  },
)
