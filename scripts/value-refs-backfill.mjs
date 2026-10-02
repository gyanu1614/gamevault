/**
 * Bundle 2 — backfill the stored listing → value item link and report what
 * could not be matched.
 *
 *   pnpm value-refs:backfill --env=local --dry-run      # report only (re-checks every listing)
 *   pnpm value-refs:backfill --env=local                 # link every listing not yet linked
 *   pnpm value-refs:backfill --env=prod --dry-run        # owner: report against production
 *   pnpm value-refs:backfill --env=prod --yes            # owner: apply (after the migration is pushed)
 *
 * Writes the unmatched report to data/value-ref-unmatched-<env>.csv. The
 * nightly /api/cron/value-listing-refs does the same linking (and revalidates
 * the value pages), so after a prod apply either wait for it or call it once.
 *
 * Run with tsx: the matcher is app TypeScript.
 */
import process from 'node:process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

import { reconcileValueRefs } from '../src/lib/value-listings/link.ts'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const ENV = val('env', '')
const DRY = has('--dry-run')
const LIMIT = Number(val('limit', '20000')) || 20000

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required (no default, on purpose).')
  process.exit(1)
}
const ENV_FILE = ENV === 'local' ? '.env.test' : '.env.local'
if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found — cannot resolve credentials for --env=${ENV}.`)
  process.exit(1)
}
loadEnv({ path: ENV_FILE })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error(`✗ ${ENV_FILE} is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`)
  process.exit(1)
}
const isLocalUrl = /(?:localhost|127\.0\.0\.1)/.test(URL)
if (ENV === 'local' && !isLocalUrl) {
  console.error(`✗ --env=local but ${ENV_FILE} points at ${URL}. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && isLocalUrl) {
  console.error(`✗ --env=prod but ${ENV_FILE} points at a local URL. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && !DRY && !has('--yes')) {
  console.error('✗ --env=prod without --dry-run needs an explicit --yes.')
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

const out = await reconcileValueRefs(supabase, { limit: LIMIT, dryRun: DRY, all: DRY })
console.log(`${DRY ? 'DRY RUN — ' : ''}checked ${out.checked} · linked ${out.linked} · unmatched (value games) ${out.unmatched.length} · errors ${out.errors.length}`)
for (const e of out.errors.slice(0, 10)) console.error('  ✗', e)

mkdirSync('data', { recursive: true })
const file = `data/value-ref-unmatched-${ENV}.csv`
const csv = ['id,game,title,template_keys']
  .concat(out.unmatched.map((u) => [u.id, u.gameSlug, JSON.stringify(u.title), JSON.stringify(u.templateKeys.join('|'))].join(',')))
  .join('\n')
writeFileSync(file, csv + '\n')
console.log(`unmatched report → ${file}`)
if (out.errors.length) process.exitCode = 1
