#!/usr/bin/env node
/**
 * Byte-identical gate for the content-hub generalisation (Phase 1 · Step 3, PR 1).
 *
 * PR 1 rewires the hub routes, sitemap and footer to read a per-game config
 * instead of hardcoded slugs. The intended change to SAB and Adopt Me output is
 * ZERO. This script proves that by fetching each page from the live baseline
 * and from the PR preview and diffing the HTML after removing the things that
 * legitimately differ between two deployments of the same code.
 *
 * Usage:
 *   node scripts/verify-hub-html-diff.mjs \
 *     --baseline https://dropmarket.gg \
 *     --preview  https://<branch>-<hash>.vercel.app
 *
 *   --json <path>   also write a machine-readable report
 *   --keep <dir>    save fetched HTML for manual inspection
 *   --concurrency N parallel fetches (default 4)
 *
 * Exit code 0 = every page identical (the merge gate). Non-zero = a real diff,
 * printed as a unified diff with context.
 *
 * WHY NORMALISE: two deployments of identical code still differ in build id,
 * asset hashes, CSRF/nonce values, and — on price pages — the "updated HH:MM
 * UTC" freshness line and any value that a crawl refreshed between the two
 * fetches. Those are not regressions. Everything else is.
 *
 * IMPORTANT: prices move. Run the two fetches close together, and treat a diff
 * that is only numbers inside price nodes as "re-run to confirm" rather than an
 * automatic fail — the script labels those separately (PRICE-ONLY) so a human
 * can judge, and still exits non-zero so nothing merges on an unreviewed diff.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

const BASELINE = (arg('baseline') || 'https://dropmarket.gg').replace(/\/$/, '')
const PREVIEW = arg('preview')
const JSON_OUT = arg('json')
const KEEP_DIR = arg('keep')
const CONCURRENCY = Number(arg('concurrency', '4'))
/**
 * Vercel Deployment Protection bypass token (Project Settings → Deployment
 * Protection → Protection Bypass for Automation). Without it a protected
 * preview 302s every request to vercel.com/sso-api, and a redirect-following
 * client would compare that LOGIN PAGE against the baseline — reporting a wall
 * of content diffs that are really one auth problem. `preflight()` below makes
 * that failure mode explicit instead.
 */
const BYPASS = arg('bypass') || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || null

if (!PREVIEW) {
  console.error('ERROR: --preview <url> is required (the Vercel preview URL).')
  console.error('Example: node scripts/verify-hub-html-diff.mjs --preview https://abc.vercel.app')
  process.exit(2)
}

/**
 * The pages the gate covers. Per the plan: both hubs, 5 value pages each, the
 * calculators, price-index, methodology and one blog post. Value-page slugs are
 * discovered from the live sitemap so this does not hardcode item names that
 * may churn.
 */
const STATIC_PATHS = [
  '/steal-a-brainrot/values',
  '/steal-a-brainrot/calculator',
  '/steal-a-brainrot/price-index',
  '/steal-a-brainrot/values/methodology',
  '/steal-a-brainrot/blog',
  '/adopt-me/values',
  '/adopt-me/calculator',
  '/adopt-me/neon-calculator',
  '/adopt-me/values/methodology',
  '/adopt-me/blog',
]

const VALUE_PAGES_PER_GAME = 5

/**
 * Cookie jar, per origin. Vercel's bypass flow answers the first request with
 * `set-cookie: _vercel_jwt=…`; sending that back makes subsequent requests
 * cheap and keeps the bypass sticky across the ~20 pages we fetch.
 */
const cookieJar = new Map()

function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function storeCookies(url, res) {
  const origin = originOf(url)
  if (!origin) return
  // undici exposes multiple Set-Cookie headers via getSetCookie().
  const raw =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean)
  if (!raw.length) return
  const jar = cookieJar.get(origin) ?? new Map()
  for (const line of raw) {
    const [pair] = String(line).split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
  cookieJar.set(origin, jar)
}

function cookieHeader(url) {
  const jar = cookieJar.get(originOf(url))
  if (!jar || !jar.size) return null
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Fetch one page.
 *
 * Redirects are followed MANUALLY, and only within the same origin. A
 * protected preview answers with a 302 to vercel.com/sso-api, which bounces on
 * to vercel.com/login and then re-issues the whole chain — following that with
 * `redirect: 'follow'` produced "redirect count exceeded" even with a valid
 * bypass token, because the bypass header does not apply to vercel.com.
 * Stopping at the first off-origin hop turns that infinite loop into a single
 * reportable fact: `offOrigin`.
 *
 * The bypass header goes on EVERY request (not just the first): each page is a
 * fresh request, and a 302 can be re-issued at any time if the cookie is
 * missing or expired.
 */
async function fetchText(url, { timeout = 45000, maxHops = 5 } = {}) {
  let current = url
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeout)
    let res
    try {
      const cookie = cookieHeader(current)
      res = await fetch(current, {
        signal: ctrl.signal,
        // Manual: we decide whether a redirect is safe to follow.
        redirect: 'manual',
        headers: {
          'user-agent': 'DropMarket-hub-diff/1.0',
          accept: 'text/html',
          'cache-control': 'no-cache',
          ...(cookie ? { cookie } : {}),
          ...(BYPASS
            ? {
                'x-vercel-protection-bypass': BYPASS,
                // Ask Vercel to hand back a bypass cookie on the first hit; the
                // jar carries it from then on.
                'x-vercel-set-bypass-cookie': 'true',
              }
            : {}),
        },
      })
    } finally {
      clearTimeout(t)
    }

    storeCookies(current, res)

    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current).toString()
      if (originOf(next) !== originOf(current)) {
        // Off-origin = an auth wall. Report it; never follow it.
        return {
          status: res.status,
          body: '',
          finalUrl: next,
          offOrigin: true,
        }
      }
      current = next
      continue
    }

    return { status: res.status, body: await res.text(), finalUrl: current }
  }
  return { status: 599, body: '', finalUrl: current, tooManyHops: true }
}

/** Discover real value-page slugs from the baseline sitemap. */
async function discoverValuePaths() {
  const out = []
  try {
    const { body } = await fetchText(`${BASELINE}/sitemap.xml`)
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    // A sitemap index points at child sitemaps; follow one level.
    const children = locs.filter((u) => u.endsWith('.xml'))
    let all = locs
    for (const child of children.slice(0, 8)) {
      try {
        const { body: b } = await fetchText(child)
        all = all.concat([...b.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
      } catch {}
    }
    for (const game of ['steal-a-brainrot', 'adopt-me']) {
      const re = new RegExp(`/${game}/values/([^/<?#]+)$`)
      const slugs = all
        .map((u) => (u.match(re) || [])[1])
        .filter((s) => s && s !== 'methodology')
      out.push(...slugs.slice(0, VALUE_PAGES_PER_GAME).map((s) => `/${game}/values/${s}`))
    }
  } catch (e) {
    console.warn(`WARN: could not read sitemap (${e.message}); value pages skipped.`)
  }
  return out
}

/**
 * Strip what legitimately differs between two deployments of identical code.
 * Deliberately conservative: anything not listed here is treated as a real
 * difference, because the whole point is to catch unintended changes.
 */
function normalise(html) {
  let s = html

  // Next.js build id + hashed asset URLs.
  s = s.replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/HASH')
  s = s.replace(/"buildId":"[^"]*"/g, '"buildId":"BUILD"')
  s = s.replace(/\?dpl=[A-Za-z0-9_-]+/g, '?dpl=DPL')

  // Deployment-specific ids, nonces, CSRF tokens.
  s = s.replace(/nonce="[^"]*"/g, 'nonce="N"')
  s = s.replace(/(name="csrf-token"\s+content=)"[^"]*"/g, '$1"CSRF"')

  // The preview host appears in canonicals/OG tags; fold both to one token so
  // host differences are not reported as content differences.
  s = s.split(PREVIEW).join('HOST')
  s = s.split(BASELINE).join('HOST')

  // Timestamps and freshness copy (the pages advertise real update times).
  s = s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, 'TIMESTAMP')
  s = s.replace(/updated\s+\d{1,2}:\d{2}\s*(UTC)?/gi, 'updated TIME')
  s = s.replace(/\b\d{1,2}:\d{2}\s*(AM|PM|UTC)\b/gi, 'TIME')
  // "3 hours ago" / "2 days ago"
  s = s.replace(/\b\d+\s+(second|minute|hour|day|week|month)s?\s+ago\b/gi, 'RELTIME')

  // Collapse whitespace so formatting-only shifts do not mask or create diffs.
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** A second pass that also blanks money values, to classify price-only drift. */
function normaliseIgnoringPrices(s) {
  return s
    .replace(/\$\s?[\d,]+(\.\d+)?/g, '$PRICE')
    .replace(/\b\d+(\.\d+)?%/g, 'PCT')
    .replace(/\b\d[\d,]*(\.\d+)?\b/g, 'NUM')
}

function unifiedDiff(a, b, label, context = 60) {
  // Character-level first difference, then a windowed excerpt — enough to see
  // what changed without dumping two full pages.
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const start = Math.max(0, i - context)
  return [
    `--- baseline ${label}`,
    `+++ preview  ${label}`,
    `@@ first difference at char ${i} @@`,
    `- …${a.slice(start, i + context)}…`,
    `+ …${b.slice(start, i + context)}…`,
  ].join('\n')
}

async function mapLimit(items, limit, fn) {
  const out = []
  let idx = 0
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (idx < items.length) {
      const my = idx++
      out[my] = await fn(items[my])
    }
  })
  await Promise.all(workers)
  return out
}

/**
 * Refuse to run against a deployment that is not actually serving the app.
 * A protected preview answers every path with a 302 to vercel.com/sso-api;
 * following it yields a login page that diffs against everything. Detect that
 * up front and say so, rather than emitting 20 meaningless "diffs".
 */
async function preflight() {
  const probe = '/steal-a-brainrot/values'
  const res = await fetchText(`${PREVIEW}${probe}`)
  const blocked =
    res.offOrigin === true ||
    /Authentication Required|vercel\.com\/(sso-api|login)|\/_vercel\/sso/i.test(
      (res.body || '').slice(0, 4000),
    )
  if (blocked) {
    console.error('GATE: CANNOT RUN — the preview is behind Vercel Deployment Protection.')
    console.error(`  ${PREVIEW}${probe}`)
    console.error(`  redirected to: ${res.finalUrl}`)
    console.error('')
    if (BYPASS) {
      console.error('A bypass token WAS sent and the deployment still refused it.')
      console.error('A rejected token is indistinguishable from none at the edge')
      console.error('(both answer 302), so check the token itself:')
      console.error('  - it must come from THIS project\'s Deployment Protection')
      console.error('    ("Protection Bypass for Automation"), not another project')
      console.error('    and not an app-level secret;')
      console.error('  - regenerate it if unsure, then re-run.')
      console.error('')
    }
    console.error('Fix either way:')
    console.error('  a) Vercel → Project → Settings → Deployment Protection →')
    console.error('     "Protection Bypass for Automation" → copy the secret, then re-run with')
    console.error('     --bypass <secret>   (or set VERCEL_AUTOMATION_BYPASS_SECRET)')
    console.error('  b) Or set this deployment\'s protection to "Only Preview Comments"/disabled.')
    process.exit(2)
  }
  if (res.status >= 400) {
    console.error(`GATE: CANNOT RUN — preview returned ${res.status} for ${probe}.`)
    process.exit(2)
  }
}

async function main() {
  await preflight()
  const discovered = await discoverValuePaths()
  const paths = [...STATIC_PATHS, ...discovered]

  console.log(`Baseline : ${BASELINE}`)
  console.log(`Preview  : ${PREVIEW}`)
  console.log(`Pages    : ${paths.length} (${discovered.length} value pages discovered)\n`)

  if (KEEP_DIR) await mkdir(KEEP_DIR, { recursive: true })

  const results = await mapLimit(paths, CONCURRENCY, async (p) => {
    try {
      const [base, prev] = await Promise.all([
        fetchText(`${BASELINE}${p}`),
        fetchText(`${PREVIEW}${p}`),
      ])
      if (KEEP_DIR) {
        const safe = p.replace(/\//g, '_') || 'root'
        await writeFile(path.join(KEEP_DIR, `${safe}.baseline.html`), base.body)
        await writeFile(path.join(KEEP_DIR, `${safe}.preview.html`), prev.body)
      }
      if (base.status !== prev.status) {
        return { path: p, verdict: 'STATUS', detail: `baseline ${base.status} vs preview ${prev.status}` }
      }
      if (base.status >= 400) {
        return { path: p, verdict: 'SKIP', detail: `both ${base.status}` }
      }
      const a = normalise(base.body)
      const b = normalise(prev.body)
      if (a === b) return { path: p, verdict: 'IDENTICAL' }

      // Identical once money/numbers are blanked → almost certainly a crawl
      // landing between the two fetches, not a code regression.
      if (normaliseIgnoringPrices(a) === normaliseIgnoringPrices(b)) {
        return {
          path: p,
          verdict: 'PRICE-ONLY',
          detail: 'differs only in numeric/price values — re-run to confirm',
          diff: unifiedDiff(a, b, p),
        }
      }
      return { path: p, verdict: 'DIFF', diff: unifiedDiff(a, b, p) }
    } catch (e) {
      return { path: p, verdict: 'ERROR', detail: e.message }
    }
  })

  const by = (v) => results.filter((r) => r.verdict === v)
  for (const r of results) {
    const mark = { IDENTICAL: '✅', 'PRICE-ONLY': '🟡', DIFF: '❌', STATUS: '❌', ERROR: '⚠️', SKIP: '·' }[r.verdict]
    console.log(`${mark} ${r.verdict.padEnd(11)} ${r.path}${r.detail ? ` — ${r.detail}` : ''}`)
  }

  const bad = [...by('DIFF'), ...by('STATUS')]
  const soft = [...by('PRICE-ONLY'), ...by('ERROR')]
  for (const r of [...bad, ...by('PRICE-ONLY')]) {
    if (r.diff) console.log(`\n${r.diff}\n`)
  }

  console.log(
    `\nSummary: ${by('IDENTICAL').length} identical · ${by('PRICE-ONLY').length} price-only · ` +
      `${by('DIFF').length} diff · ${by('STATUS').length} status · ${by('ERROR').length} error · ${by('SKIP').length} skipped`,
  )

  if (JSON_OUT) {
    await writeFile(JSON_OUT, JSON.stringify({ baseline: BASELINE, preview: PREVIEW, results }, null, 2))
    console.log(`Report written to ${JSON_OUT}`)
  }

  if (bad.length) {
    console.log('\nGATE: FAIL — unintended differences found.')
    process.exit(1)
  }
  if (soft.length) {
    console.log('\nGATE: REVIEW — no structural diffs, but price/fetch noise needs a human. Re-run to confirm.')
    process.exit(3)
  }
  console.log('\nGATE: PASS — every page byte-identical after timestamp normalisation.')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
