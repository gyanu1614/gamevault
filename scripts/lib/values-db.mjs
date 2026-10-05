/**
 * Service-role client for the values_* owner scripts, with the same target
 * guard as seed:games: the caller names the environment, and a mismatch
 * between the name and the URL refuses to run.
 *
 *   --env=local   .env.test  (this worktree's local stack; must be localhost)
 *   --env=prod    .env.local (production; must NOT be localhost; needs --yes)
 *   (no --env)    process.env, ONLY on a GitHub Actions runner (the daily job)
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

const isLocalUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(url ?? '')

export function valuesDbClient({ env, yes = false } = {}) {
  if (env === 'local' || env === 'prod') {
    const file = env === 'local' ? '.env.test' : '.env.local'
    if (!fs.existsSync(file)) throw new Error(`${file} not found — cannot resolve credentials for --env=${env}`)
    loadEnv({ path: file, override: true, quiet: true })
  } else if (env) {
    throw new Error(`--env must be local or prod (got "${env}")`)
  } else if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('--env=local or --env=prod is required outside GitHub Actions (no default, on purpose)')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  if (env === 'local' && !isLocalUrl(url)) throw new Error(`--env=local but the URL is ${url}. Refusing.`)
  if (env === 'prod' && isLocalUrl(url)) throw new Error('--env=prod but the URL is local. Refusing.')
  if (env === 'prod' && !yes) throw new Error('--env=prod writes need an explicit --yes')

  return { db: createClient(url, key, { auth: { persistSession: false } }), url }
}

/** Page through a select in 1000-row chunks with a stable order. */
export async function selectAllRows(build, orderBy) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().order(orderBy).range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}
