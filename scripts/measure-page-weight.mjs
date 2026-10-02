#!/usr/bin/env node
/**
 * Page-weight + prefetch measurement for the five crawl-critical routes.
 *
 * Why: Google spends 47% of its crawl on "page resource load" and 26% on
 * `?_rsc=` prefetch files. This records what one page view costs, so a change
 * to preloads, images, scripts or link prefetching shows up as a number.
 *
 * Per route and viewport (desktop 1440x900, mobile 375x812) it records:
 *   - requests BEFORE interaction (load + network idle + 1.5s settle, no scroll)
 *   - `_rsc` prefetch requests before interaction and after scrolling to the end
 *   - from the raw HTML (what a crawler parses first): <link rel=preload> tags,
 *     <script src>, <img> total / eager (no loading="lazy") / lazy
 *   - JS bytes (decoded + transferred), total transferred bytes
 *   - non-prefetch fetch/XHR calls (the crawl-stats "JSON" row)
 *   - screenshots: above the fold, and full page after scrolling to load lazy images
 *
 * Usage (a PRODUCTION build: `next start`; dev mode never prefetches):
 *   node scripts/measure-page-weight.mjs --base=http://127.0.0.1:3101 --label=before
 *   node scripts/measure-page-weight.mjs --base=http://127.0.0.1:3102 --label=after
 *   node scripts/measure-page-weight.mjs --compare=before,after      # markdown table
 *   node scripts/measure-page-weight.mjs --screens=before,after      # pixel diff of screenshots
 *   node scripts/measure-page-weight.mjs --base=https://dropmarket.gg --label=prod-html --html-only
 *
 * Options: --out=<dir> (default .measure-out)  --routes=home,hub  --item=<sab slug>
 * Results land in <out>/<label>/results.json and the PNGs next to it.
 * Seed realistic local data first: node --experimental-strip-types scripts/measure-seed.mjs
 * Uses the installed Chrome (falls back to Playwright's Chromium); no new dependency.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  }),
)
const OUT = path.resolve(String(args.out ?? '.measure-out'))
const ITEM = String(args.item ?? 'cavallo-virtuoso')

const ROUTES = [
  { key: 'home', path: '/' },
  { key: 'hub', path: '/valorant' },
  { key: 'category', path: '/valorant/buy-vp' },
  { key: 'values-hub', path: '/steal-a-brainrot/values' },
  { key: 'value-item', path: `/steal-a-brainrot/values/${ITEM}` },
].filter((r) => !args.routes || String(args.routes).split(',').includes(r.key))

const ALL_VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
}
const VIEWPORTS = Object.fromEntries(
  Object.entries(ALL_VIEWPORTS).filter(([k]) => !args.viewports || String(args.viewports).split(',').includes(k)),
)
// MEASURE_DEBUG=1 prints a timestamp per stage: which step stalls on a slow machine.
const T0 = Date.now()
const stage = (m) => process.env.MEASURE_DEBUG && console.error(`  [${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`)

const FREEZE_CSS = `
  [data-sonner-toaster], [data-sonner-toast] { display: none !important; }
  *, *::before, *::after {
    animation-duration: 0s !important; animation-delay: 0s !important;
    transition-duration: 0s !important; caret-color: transparent !important;
  }`

// ── HTML analysis (what a crawler sees in the first response) ──────────────
export function analyseHtml(html) {
  const preloadTags = html.match(/<link\b[^>]*\brel=["']preload["'][^>]*>/gi) ?? []
  const preloadAs = {}
  for (const tag of preloadTags) {
    const as = tag.match(/\bas=["']([^"']+)["']/i)?.[1] ?? 'other'
    preloadAs[as] = (preloadAs[as] ?? 0) + 1
  }
  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  const lazy = imgs.filter((t) => /\bloading=["']lazy["']/i.test(t)).length
  // Which images load eagerly (no loading="lazy"): the list to work down.
  const eagerSrcs = imgs
    .filter((t) => !/\bloading=["']lazy["']/i.test(t))
    .map((t) => (t.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? '(no src)').replace(/\?.*$/, ''))
  return {
    eagerSrcs,
    htmlBytes: Buffer.byteLength(html),
    preloads: preloadTags.length,
    preloadAs,
    scriptTags: (html.match(/<script\b[^>]*\bsrc=/gi) ?? []).length,
    stylesheetLinks: (html.match(/<link\b[^>]*\brel=["']stylesheet["']/gi) ?? []).length,
    imgTags: imgs.length,
    eagerImgs: imgs.length - lazy,
    lazyImgs: lazy,
  }
}

const isRsc = (url) => /[?&]_rsc=/.test(url)

async function measureHtmlOnly(base, route) {
  const res = await fetch(new URL(route.path, base), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } })
  return { status: res.status, html: analyseHtml(await res.text()) }
}

// ── browser measurement ────────────────────────────────────────────────────
async function launch() {
  // A generous timeout: on a loaded machine Chrome can take well over the 30 s default.
  try {
    return await chromium.launch({ channel: 'chrome', timeout: 180_000 })
  } catch (e) {
    console.error(`system Chrome did not launch (${e.message.split('\n')[0]}); trying Playwright's Chromium`)
    return chromium.launch({ timeout: 180_000 })
  }
}

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(800)
  await page.waitForLoadState('networkidle').catch(() => {})
  // Wait for images that are actually rendered. A lazy <img> inside a display:none
  // block never loads and never fires an event, so cap the wait.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        [...document.images]
          .filter((i) => !i.complete && i.getClientRects().length > 0)
          .map((i) => new Promise((r) => { i.onload = i.onerror = r })),
      ),
      new Promise((r) => setTimeout(r, 4000)),
    ]),
  )
}

/** A route that hangs must not stall the whole run. */
function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms) }),
  ]).finally(() => clearTimeout(timer))
}

async function measureRoute(browser, base, route, vpName, shotsDir) {
  const context = await browser.newContext({ ...VIEWPORTS[vpName], deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const reqs = []
  let phase = 'load'

  page.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    reqs.push({ req, url, type: req.resourceType(), method: req.method(), phase, enc: 0, dec: 0, failed: false })
  })
  page.on('requestfinished', async (req) => {
    const rec = reqs.find((r) => r.req === req)
    if (!rec) return
    try { const s = await req.sizes(); rec.enc = s.responseBodySize + s.responseHeadersSize } catch {}
    if (rec.type === 'script') { try { rec.dec = (await (await req.response()).body()).length } catch {} }
  })
  page.on('requestfailed', (req) => {
    const rec = reqs.find((r) => r.req === req)
    if (rec) rec.failed = true
  })

  const target = new URL(route.path, base).toString()
  stage(`goto ${route.key}/${vpName}`)
  const response = await page.goto(target, { waitUntil: 'load', timeout: 180_000 })
  stage('loaded')
  const status = response.status()
  const html = analyseHtml(await response.text())
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  stage('settled')
  await page.addStyleTag({ content: FREEZE_CSS })
  await page.screenshot({ path: path.join(shotsDir, `${route.key}-${vpName}-fold.png`), timeout: 120_000 })
  stage('fold screenshot')

  const before = reqs.filter((r) => r.phase === 'load')
  phase = 'scroll'
  await scrollThrough(page)
  stage('scrolled')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(shotsDir, `${route.key}-${vpName}-full.png`), fullPage: true, timeout: 180_000 })
  stage('full screenshot')
  await page.waitForTimeout(300)

  const byType = {}
  for (const r of before) byType[r.type] = (byType[r.type] ?? 0) + 1
  const js = before.filter((r) => r.type === 'script')
  const json = {}
  for (const r of reqs.filter((x) => (x.type === 'fetch' || x.type === 'xhr') && !isRsc(x.url))) {
    const u = new URL(r.url)
    const key = `${r.method} ${u.host}${u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')}`
    json[key] = (json[key] ?? 0) + 1
  }

  const result = {
    status,
    requestsBeforeInteraction: before.length,
    requestsByType: byType,
    failedBeforeInteraction: before.filter((r) => r.failed).length,
    rscBeforeInteraction: before.filter((r) => isRsc(r.url)).length,
    rscAfterScroll: reqs.filter((r) => isRsc(r.url)).length,
    requestsAfterScroll: reqs.length,
    jsFiles: js.length,
    jsBytesDecoded: js.reduce((n, r) => n + r.dec, 0),
    jsBytesTransferred: js.reduce((n, r) => n + r.enc, 0),
    transferredBytesBeforeInteraction: before.reduce((n, r) => n + r.enc, 0),
    nonPrefetchJsonCalls: json,
    html,
  }
  await context.close()
  return result
}

// ── comparison tables ──────────────────────────────────────────────────────
const readResults = (label) => JSON.parse(readFileSync(path.join(OUT, label, 'results.json'), 'utf8'))
const pct = (a, b) => (a === 0 ? '–' : `${(((b - a) / a) * 100).toFixed(0)}%`)
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

function compare(labelA, labelB) {
  const A = readResults(labelA).routes
  const B = readResults(labelB).routes
  const rows = (title, fmt, pick) => {
    console.log(`\n### ${title}\n`)
    console.log(`| route | viewport | before | after | change |\n|---|---|---|---|---|`)
    for (const key of Object.keys(A)) for (const vp of Object.keys(A[key])) {
      const a = pick(A[key][vp]); const b = pick(B[key]?.[vp] ?? A[key][vp])
      console.log(`| ${key} | ${vp} | ${fmt(a)} | ${fmt(b)} | ${pct(a, b)} |`)
    }
  }
  rows('Requests before interaction', String, (r) => r.requestsBeforeInteraction)
  rows('<link rel=preload> tags in HTML', String, (r) => r.html.preloads)
  rows('Eager <img> in HTML', String, (r) => r.html.eagerImgs)
  rows('<script src> tags in HTML', String, (r) => r.html.scriptTags)
  rows('JS transferred', kb, (r) => r.jsBytesTransferred)
  rows('`_rsc` prefetch requests: before interaction', String, (r) => r.rscBeforeInteraction)
  rows('`_rsc` prefetch requests: after scrolling to the end', String, (r) => r.rscAfterScroll)
}

// ── screenshot pixel diff (runs inside the browser; no image dependency) ───
async function screens(labelA, labelB) {
  const browser = await launch()
  const page = await browser.newPage()
  const rows = []
  for (const key of Object.keys(readResults(labelA).routes)) for (const vp of Object.keys(readResults(labelA).routes[key])) for (const kind of ['fold', 'full']) {
    const name = `${key}-${vp}-${kind}.png`
    const fa = path.join(OUT, labelA, name); const fb = path.join(OUT, labelB, name)
    if (!existsSync(fa) || !existsSync(fb)) continue
    const diff = await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src })
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const w = Math.max(ia.width, ib.width); const h = Math.max(ia.height, ib.height)
      const draw = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data }
      const da = draw(ia); const db = draw(ib)
      let bad = 0
      for (let i = 0; i < da.length; i += 4) {
        if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) bad++
      }
      return { before: [ia.width, ia.height], after: [ib.width, ib.height], bad, total: w * h }
    }, [`data:image/png;base64,${readFileSync(fa).toString('base64')}`, `data:image/png;base64,${readFileSync(fb).toString('base64')}`])
    rows.push({ name, ...diff })
  }
  await browser.close()
  console.log(`| screenshot | before px | after px | differing pixels |\n|---|---|---|---|`)
  for (const r of rows) console.log(`| ${r.name} | ${r.before.join('x')} | ${r.after.join('x')} | ${((r.bad / r.total) * 100).toFixed(2)}% |`)
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  if (args.compare) return compare(...String(args.compare).split(','))
  if (args.screens) return screens(...String(args.screens).split(','))

  const base = String(args.base ?? '')
  const label = String(args.label ?? '')
  if (!base || !label) {
    console.error('usage: --base=<url> --label=<name> [--html-only] | --compare=a,b | --screens=a,b')
    process.exit(1)
  }
  const dir = path.join(OUT, label)
  mkdirSync(dir, { recursive: true })
  const out = { base, label, measuredAt: new Date().toISOString(), routes: {} }

  if (args['html-only']) {
    for (const route of ROUTES) {
      const { status, html } = await measureHtmlOnly(base, route)
      out.routes[route.key] = { html: { status, ...html } }
      console.log(`${route.key.padEnd(11)} ${status}  preloads ${html.preloads}  scripts ${html.scriptTags}  img ${html.imgTags} (eager ${html.eagerImgs})  html ${(html.htmlBytes / 1024).toFixed(0)} KB`)
    }
  } else {
    const browser = await launch()
    for (const route of ROUTES) {
      out.routes[route.key] = {}
      for (const vp of Object.keys(VIEWPORTS)) {
        let r
        try {
          r = await withTimeout(measureRoute(browser, base, route, vp, dir), 240_000, `${route.key}/${vp}`)
        } catch (e) {
          console.error(`${route.key.padEnd(11)} ${vp.padEnd(8)} FAILED: ${e.message}`)
          continue
        }
        out.routes[route.key][vp] = r
        console.log(
          `${route.key.padEnd(11)} ${vp.padEnd(8)} ${r.status}  req ${String(r.requestsBeforeInteraction).padStart(3)}  preload ${r.html.preloads}  eager img ${String(r.html.eagerImgs).padStart(2)}/${r.html.imgTags}  js ${r.jsFiles} files ${kb(r.jsBytesTransferred)}  _rsc ${r.rscBeforeInteraction}->${r.rscAfterScroll}`,
        )
      }
    }
    await browser.close()
  }
  writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 2))
  console.log(`\nwrote ${path.join(dir, 'results.json')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
