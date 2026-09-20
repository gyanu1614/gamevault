#!/usr/bin/env node
/**
 * Public-route caching guard — Phase 1 · Step 7a.
 *
 * Every public page must be static-first (ISR). The four ways a page silently
 * falls back to per-request rendering, each of which showed up in the Step 7a
 * audit, are checked statically here:
 *
 *   R1  cookie client — the page's SERVER import graph reaches
 *       `@/lib/supabase/server` or `next/headers`. One `cookies()` call
 *       anywhere in the graph makes the whole route dynamic (`private,
 *       no-store`, a full render per hit). Public reads go through
 *       `@/lib/supabase/anon`; personalisation is computed client-side.
 *   R2  searchParams — the page reads `searchParams` server-side. That opts
 *       the route out of static rendering even with `revalidate` set (the
 *       calculator shipped that way). Read them in a client component instead.
 *   R3  force-dynamic / noStore / connection() — explicit opt-outs.
 *   R4  closed set — a page whose generateStaticParams derives from the
 *       content-hub config (`contentHubSlugsFor` / `CONTENT_HUB_GAME_SLUGS`)
 *       serves a closed set of params and must export `dynamicParams = false`.
 *       NOTE: on Vercel that flag alone is NOT enforced at runtime (Next only
 *       throws its fallback-false 404 outside minimal mode; the Step 7a
 *       preview served /rust/blog as 200). The page body must ALSO
 *       `notFound()` by the same rule — the 404 is then cached by ISR.
 *   R5  ISR — a public page under a dynamic segment must export a numeric
 *       `revalidate` (or `dynamic = 'force-static'`).
 *
 * `pnpm build` runs this before `next build`, so a route that breaks the rules
 * fails the deploy. `src/test/guards/public-route-caching.guard.test.ts` runs
 * the same function under vitest.
 *
 * Grandfathered routes are listed with the reason; removing an entry is the
 * way to declare a route fixed. Adding one needs the same review a
 * `dynamic = 'force-dynamic'` would.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const APP = join(SRC, 'app')

/**
 * Top-level app segments (or route groups) that serve signed-in or
 * transactional surfaces. Everything else under src/app is a public route.
 */
export const PRIVATE_SEGMENTS = new Set([
  '(admin)',
  '(admin-auth)',
  '(seller)',
  '(sell)',
  'account',
  'auth',
  'cart',
  'checkout',
  'dev',
  'early-seller',
  'forgot-password',
  'founding',
  'kyc',
  'login',
  'messages',
  'notifications',
  'onboarding',
  'orders',
  'purchases',
  'reset-password',
  'signup',
  'support',
  'wallet',
  'wishlist',
])

/**
 * Public routes that still render per request. Each entry names the rule it
 * breaks and why it is tolerated for now. Paths are app-relative (no
 * `src/app/` prefix, no `/page.tsx`).
 */
export const GRANDFATHERED = {
  // Listing detail: still resolves the viewer server-side (own-listing
  // controls) and reads through the cookie client. Next candidate for the
  // same treatment as [categorySlug].
  '(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]': ['R1', 'R5'],
  // Legacy id resolver that 301s to the canonical listing URL; no params set.
  'listings/[id]': ['R1', 'R5'],
  // /buy landing pages: inventory resolver (lib/seo/landingPageInventory) is
  // still on the cookie client. Out of Step 7a's scope; tracked as follow-up.
  'buy/[seoSlug]': ['R1'],
}

/**
 * `[gameSlug]` routes whose generateStaticParams SEEDS the hub games but whose
 * body serves any active game (open set, DB-gated `notFound()`). R4 does not
 * apply to them. The sell page is the one case today; prerendering all 233
 * sell pages (they are all in the sitemap) is the better follow-up.
 */
export const SEEDED_OPEN_SET = new Set(['(marketplace)/[gameSlug]/sell'])

/**
 * Server-action modules that mix cookie-client exports (writes, "my" reads)
 * with cookie-free public reads. The graph walk cannot tell which export a
 * page calls, so these are allowed by name; the public-read exports are
 * covered by behaviour tests (`category-page-anon-reads.test.ts`). A NEW mixed
 * module is a violation: split the public read into a cookie-free module.
 */
export const MIXED_ACTION_MODULES = new Set([
  'src/lib/actions/seller-presence.ts',
  'src/lib/actions/admin-category-configs.ts',
  'src/lib/actions/new-schema.ts',
])

const COOKIE_SPECIFIERS = new Set(['@/lib/supabase/server', 'next/headers'])
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

function listPages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) listPages(p, out)
    else if (name === 'page.tsx' || name === 'page.ts') out.push(p)
  }
  return out
}

function appRelative(pagePath) {
  return relative(APP, dirname(pagePath)).split(sep).join('/')
}

export function isPublicRoute(appRel) {
  const first = appRel.split('/')[0]
  return !PRIVATE_SEGMENTS.has(first)
}

function directive(source) {
  const m = source.match(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"](use client|use server)['"]/)
  return m ? m[1] : null
}

function importSpecifiers(source) {
  const specs = []
  const re =
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(source))) specs.push(m[1] ?? m[2] ?? m[3])
  return specs
}

function resolveSpecifier(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate)) return candidate
  }
  return null
}

const sourceCache = new Map()
function read(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, readFileSync(file, 'utf8'))
  return sourceCache.get(file)
}

/**
 * Walk the server import graph from a page. Stops at 'use client' modules
 * (they cannot import server code) and at allow-listed mixed action modules.
 * Returns the cookie-client edges found, each as `importer → specifier`.
 */
function cookieEdges(pageFile) {
  const seen = new Set()
  const edges = []
  const stack = [pageFile]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const rel = relative(ROOT, file).split(sep).join('/')
    if (file !== pageFile && directive(read(file)) === 'use client') continue
    if (MIXED_ACTION_MODULES.has(rel)) continue
    for (const spec of importSpecifiers(read(file))) {
      if (COOKIE_SPECIFIERS.has(spec)) edges.push(`${rel} → ${spec}`)
      const target = resolveSpecifier(spec, file)
      if (target && target.startsWith(SRC)) stack.push(target)
    }
  }
  return edges
}

/** Server-action modules reachable from the page that are not allow-listed. */
function newMixedActionModules(pageFile) {
  const seen = new Set()
  const found = []
  const stack = [pageFile]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const rel = relative(ROOT, file).split(sep).join('/')
    const src = read(file)
    if (file !== pageFile && directive(src) === 'use client') continue
    if (MIXED_ACTION_MODULES.has(rel)) continue
    if (directive(src) === 'use server' && /@\/lib\/supabase\/server/.test(src)) {
      found.push(rel)
      continue
    }
    for (const spec of importSpecifiers(src)) {
      const target = resolveSpecifier(spec, file)
      if (target && target.startsWith(SRC)) stack.push(target)
    }
  }
  return found
}

/** Source text of `generateStaticParams` — from its declaration to the first
 *  line that is a lone closing brace. Good enough for the flat function style
 *  every route file uses; a nested style would only widen the match. */
function staticParamsBody(source) {
  const m = source.match(/export\s+(?:async\s+)?function\s+generateStaticParams[\s\S]*?\n\}/)
  return m ? m[0] : ''
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

export function checkPage(pageFile) {
  const appRel = appRelative(pageFile)
  const src = stripComments(read(pageFile))
  const violations = []

  const edges = cookieEdges(pageFile)
  const mixed = newMixedActionModules(pageFile)
  if (edges.length || mixed.length) {
    violations.push({
      rule: 'R1',
      detail: [
        ...edges.map((e) => `cookie client via ${e}`),
        ...mixed.map((m) => `new mixed action module ${m} (split the public read out)`),
      ].join('; '),
    })
  }

  if (/\bsearchParams\b/.test(src)) {
    violations.push({ rule: 'R2', detail: 'reads searchParams server-side' })
  }

  if (/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src)) {
    violations.push({ rule: 'R3', detail: "dynamic = 'force-dynamic'" })
  }
  if (/unstable_noStore|\bnoStore\(|\bconnection\(\)/.test(src)) {
    violations.push({ rule: 'R3', detail: 'noStore()/connection() opt-out' })
  }

  // Only routes whose sole dynamic segment is the game slug can be a closed
  // set; an item/post segment below it is open by nature.
  const gameOnly = /\[gameSlug\]/.test(appRel) && appRel.split('[').length === 2
  const closedSet =
    gameOnly &&
    !SEEDED_OPEN_SET.has(appRel) &&
    /contentHubSlugsFor\(|CONTENT_HUB_GAME_SLUGS|getBlogHubGameSlugs\(/.test(staticParamsBody(src))
  if (closedSet && !/export\s+const\s+dynamicParams\s*=\s*false/.test(src)) {
    violations.push({
      rule: 'R4',
      detail: 'generateStaticParams derives from the closed hub config but dynamicParams is not false',
    })
  }

  // A dynamic segment needs SOME static story: prerendered params (SSG),
  // a numeric revalidate (ISR) or force-static. None of the three means every
  // hit is a render.
  const isDynamicSegment = /\[/.test(appRel)
  const hasRevalidate = /export\s+const\s+revalidate\s*=\s*\d+/.test(src)
  const forceStatic = /export\s+const\s+dynamic\s*=\s*['"]force-static['"]/.test(src)
  const hasStaticParams = /export\s+(async\s+)?function\s+generateStaticParams/.test(src)
  if (isDynamicSegment && !hasRevalidate && !forceStatic && !hasStaticParams) {
    violations.push({
      rule: 'R5',
      detail: 'dynamic segment with no generateStaticParams, revalidate or force-static',
    })
  }

  const tolerated = new Set(GRANDFATHERED[appRel] ?? [])
  return {
    route: appRel || '(root)',
    violations: violations.filter((v) => !tolerated.has(v.rule)),
    grandfathered: violations.filter((v) => tolerated.has(v.rule)),
  }
}

export function checkAll() {
  return listPages(APP)
    .filter((p) => isPublicRoute(appRelative(p)))
    .map(checkPage)
}

/** Grandfather entries whose route no longer violates — stale allow-list. */
export function staleGrandfathers(results) {
  const stale = []
  for (const [route, rules] of Object.entries(GRANDFATHERED)) {
    const r = results.find((x) => (x.route === '(root)' ? '' : x.route) === route)
    if (!r) {
      stale.push(`${route || '(root)'}: route no longer exists`)
      continue
    }
    const still = new Set(r.grandfathered.map((v) => v.rule))
    for (const rule of rules) {
      if (!still.has(rule)) stale.push(`${route || '(root)'}: ${rule} no longer fires — remove it`)
    }
  }
  return stale
}

function main() {
  const results = checkAll()
  const failing = results.filter((r) => r.violations.length)
  const stale = staleGrandfathers(results)
  const report = process.argv.includes('--report')

  if (report) {
    for (const r of results) {
      if (!r.violations.length && !r.grandfathered.length) continue
      console.log(`\n${r.route}`)
      for (const v of r.violations) console.log(`  FAIL ${v.rule}: ${v.detail}`)
      for (const v of r.grandfathered) console.log(`  (grandfathered ${v.rule}: ${v.detail})`)
    }
  }

  if (failing.length || stale.length) {
    console.error('\npublic-route caching guard: FAILED')
    for (const r of failing) {
      console.error(`\n  ${r.route}`)
      for (const v of r.violations) console.error(`    ${v.rule}: ${v.detail}`)
    }
    for (const s of stale) console.error(`\n  stale grandfather — ${s}`)
    console.error('\nRules: scripts/check-public-route-caching.mjs · CLAUDE.md "Public pages are static-first"')
    process.exit(1)
  }
  console.log(`public-route caching guard: ${results.length} public routes OK`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
