#!/usr/bin/env node
/**
 * Proves, in a real browser against a PRODUCTION build (`next start`; dev mode
 * never prefetches), that AppLink links prefetch on INTENT only:
 *
 *   1. scrolling a link into view prefetches nothing        (Google's 26% `?_rsc=` waste)
 *   2. a mouse resting on a link prefetches it              (desktop keeps fast navigation)
 *   3. a mouse sweeping across a link prefetches nothing
 *   4. a touch on a link prefetches it                      (mobile keeps fast navigation)
 *
 * It looks only at links marked data-intent-prefetch (AppLink). Links in files the
 * other bundle owns still use next/link and prefetch on scroll; they are ignored here.
 *
 *   node scripts/verify-prefetch-intent.mjs --base=http://127.0.0.1:3102 [--path=/valorant]
 * Exits 1 on any failed check. Reads only.
 */
import { chromium } from 'playwright'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true] }))
const BASE = String(args.base ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const PATH = String(args.path ?? '/valorant')
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`) }

async function launch() {
  try { return await chromium.launch({ channel: 'chrome', timeout: 180_000 }) } catch { return chromium.launch({ timeout: 180_000 }) }
}

/** Every `?_rsc=` request seen so far, by pathname. */
function trackPrefetches(page) {
  const seen = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.searchParams.has('_rsc')) seen.push(u.pathname)
  })
  return (pathname) => seen.filter((p) => p === pathname).length
}

/** Links (AppLink) with distinct in-app paths, none of them the current page. */
async function intentLinks(page, n) {
  return page.evaluate(({ n, here }) => {
    const out = []
    const seen = new Set([here])
    for (const a of document.querySelectorAll('a[data-intent-prefetch][href^="/"]')) {
      const path = a.getAttribute('href').split(/[?#]/)[0]
      if (seen.has(path) || path.startsWith('//')) continue
      seen.add(path)
      out.push({ path, index: [...document.querySelectorAll('a[data-intent-prefetch]')].indexOf(a) })
      if (out.length === n) break
    }
    return out
  }, { n, here: PATH })
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

const browser = await launch()

// ── desktop ────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const count = trackPrefetches(page)
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'load', timeout: 180_000 })
  await settle(page)
  const links = await intentLinks(page, 6)
  check('the page has AppLink links to check', links.length >= 4, `${links.length} found`)
  const anchor = (i) => page.locator('a[data-intent-prefetch]').nth(links[i].index)

  // 1. scrolling every link into view prefetches none of them
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 400) { await page.evaluate((t) => window.scrollTo(0, t), y); await page.waitForTimeout(100) }
  await page.waitForTimeout(1500)
  const scrolled = links.reduce((n, l) => n + count(l.path), 0)
  check('scrolling AppLink links into view prefetches none of them', scrolled === 0, `${scrolled} prefetches for ${links.length} links`)

  // 2. a mouse that rests on a link prefetches it
  const hovered = links[0]
  await anchor(0).scrollIntoViewIfNeeded()
  const box = await anchor(0).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(1500)
  check('a mouse resting on a link prefetches it', count(hovered.path) === 1, `${count(hovered.path)} request(s) for ${hovered.path}`)

  // 3. a mouse sweeping across a link prefetches nothing
  const swept = links[1]
  await anchor(1).scrollIntoViewIfNeeded()
  const sbox = await anchor(1).boundingBox()
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2)
  await page.waitForTimeout(20) // under the 65 ms dwell
  await page.mouse.move(2, 2)
  await page.waitForTimeout(1500)
  check('a mouse sweeping across a link prefetches nothing', count(swept.path) === 0, `${count(swept.path)} request(s) for ${swept.path}`)
  await ctx.close()
}

// ── mobile (touch) ─────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const count = trackPrefetches(page)
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'load', timeout: 180_000 })
  await settle(page)
  const links = await intentLinks(page, 4)
  const target = links.find((l) => count(l.path) === 0)
  check('mobile: the page has an AppLink link not yet prefetched', !!target)
  if (target) {
    // A touch is touchstart then click ~100 ms later; the prefetch must start at touchstart.
    await page.locator('a[data-intent-prefetch]').nth(target.index).dispatchEvent('touchstart')
    await page.waitForTimeout(1500)
    check('a touch on a link prefetches it', count(target.path) === 1, `${count(target.path)} request(s) for ${target.path}`)
  }
  await ctx.close()
}

await browser.close()
process.exit(results.every(Boolean) ? 0 : 1)
