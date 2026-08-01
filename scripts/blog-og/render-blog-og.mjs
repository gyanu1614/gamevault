/**
 * Blog share-image (OG) renderer.
 *
 * Assembles the branded 1200×630 share image for each blog post: an
 * AI-generated pet scene on the right, DropMarket logo top-right, a small
 * guide-type label top-left, and the game name + date bottom-left — the "V1"
 * layout, in the content-hub palette (near-black #0A0D0B, no accent bars).
 *
 * The pet SCENE is produced separately (AI, per the prompt recipe in
 * scripts/blog-og/PET-SCENE-PROMPT.md) and dropped at:
 *     public/blog-heroes/{game}/{slug}.png
 * This script only frames it. Output goes to:
 *     public/blog-og/{game}/{slug}.png
 *
 * A post with no pet scene yet still renders — the right side falls back to a
 * dark textured panel, so nothing is ever blank.
 *
 * Manifest: scripts/blog-og/manifest.json — one entry per image (see the
 * Adopt Me seed entries already there). Regenerate all:
 *     node scripts/blog-og/render-blog-og.mjs
 * One post:
 *     node scripts/blog-og/render-blog-og.mjs --slug how-to-sell-adopt-me-pets-for-real-money
 */

import { chromium } from 'playwright'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const PUBLIC = join(ROOT, 'public')

const W = 1200
const H = 630

const onlySlug = (() => {
  const i = process.argv.indexOf('--slug')
  return i > -1 ? process.argv[i + 1] : null
})()

/** Read a file as a data URI, or null if absent. */
function dataUri(absPath, mime) {
  if (!existsSync(absPath)) return null
  const b64 = readFileSync(absPath).toString('base64')
  return `data:${mime};base64,${b64}`
}

const LOGO = dataUri(join(PUBLIC, 'brand/logo-mark-white.png'), 'image/png')

const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))

/**
 * The image markup. Kept as a single template so the design lives in one place;
 * fonts load from Google Fonts (network is available at render time).
 */
function html({ label, gameName, date, hook, petUri, layout }) {
  // The hook can carry one accent phrase wrapped in *asterisks* → rendered
  // green, and a `|` marks the intended two-line break.
  const hookHtml = hook
    ? escapeHtml(hook)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\s*\|\s*/g, '<br>')
    : ''

  // Layout B: the render fills the whole frame; NO text sits on the image (the
  // card below carries the title). Only a small logo + a bottom scrim for depth.
  if (layout === 'full') {
    const fill = petUri
      ? `<img class="fill" src="${petUri}" alt="" />`
      : ''
    return `<!doctype html><html><head><meta charset="utf-8">
<style>
  *{ margin:0; padding:0; box-sizing:border-box; }
  html,body{ width:${W}px; height:${H}px; }
  .og{ position:relative; width:${W}px; height:${H}px; background:#0A0D0B; overflow:hidden; }
  .fill{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
  /* gentle vignette so the render meets the card edges cleanly */
  .vig{ position:absolute; inset:0; z-index:2; pointer-events:none;
        box-shadow:inset 0 0 120px 40px rgba(8,11,9,.55);
        background:linear-gradient(180deg, rgba(8,11,9,.18) 0%, rgba(8,11,9,0) 22%, rgba(8,11,9,0) 72%, rgba(8,11,9,.4) 100%); }
  .logo{ position:absolute; top:40px; right:46px; height:38px; width:auto; z-index:5;
         filter:drop-shadow(0 2px 8px rgba(0,0,0,.7)); }
</style></head><body>
  <div class="og">
    ${fill}
    <div class="vig"></div>
    ${LOGO ? `<img class="logo" src="${LOGO}" alt="" />` : ''}
  </div>
</body></html>`
  }

  // Layout A (default): pets right, text on the dark left.
  const petLayer = petUri
    ? `<img class="pet" src="${petUri}" alt="" />`
    : '' // no scene yet → the textured panel shows through
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  *{ margin:0; padding:0; box-sizing:border-box; }
  html,body{ width:${W}px; height:${H}px; }
  .og{ position:relative; width:${W}px; height:${H}px; background:#0A0D0B;
       font-family:'Figtree',system-ui,sans-serif; overflow:hidden; }
  .tex{ position:absolute; inset:0;
        background:repeating-linear-gradient(-38deg, rgba(255,255,255,.022) 0 2px, transparent 2px 30px); }
  /* pet scene fills the right ~55% and bleeds off the right edge */
  .pet{ position:absolute; right:-2%; top:50%; transform:translateY(-50%);
        height:112%; width:auto; object-fit:contain; z-index:1; }
  /* left-weighted scrim keeps the text side clean and legible */
  .scrim{ position:absolute; inset:0; z-index:2;
    background:linear-gradient(90deg,#0A0D0B 0%,#0A0D0B 40%,rgba(10,13,11,.6) 60%,rgba(10,13,11,0) 90%); }
  .logo{ position:absolute; top:44px; right:48px; height:58px; width:auto; z-index:6;
         filter:drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  /* Top-left brand cluster: game name over a small guide-type label. Both in
     Figtree (our text font) — no mono, no letter-spacing gimmicks. */
  .brand{ position:absolute; left:64px; top:52px; z-index:5; display:flex; flex-direction:column; gap:6px; }
  .name{ font-size:22px; font-weight:800; letter-spacing:-.01em; color:#EDF2ED; }
  .label{ font-size:15px; letter-spacing:.02em; color:#7FB78F; font-weight:600; }
  /* Centre-left hook — the hero. Sized to sit comfortably on two lines. */
  .hook{ position:absolute; left:64px; top:50%; transform:translateY(-50%); width:560px; z-index:5;
         font-size:62px; line-height:1.02; font-weight:800; letter-spacing:-.03em; color:#F4F7F3; }
  .hook em{ font-style:normal; color:#5ED08C; }
  /* Bottom-left date — a quiet mono anchor, no longer carrying the game name. */
  .date{ position:absolute; left:64px; bottom:52px; z-index:5;
         font-family:'JetBrains Mono',ui-monospace,monospace; font-size:15px; color:#616e64; letter-spacing:.04em; }
</style></head><body>
  <div class="og">
    <div class="tex"></div>
    ${petLayer}
    <div class="scrim"></div>
    ${LOGO ? `<img class="logo" src="${LOGO}" alt="" />` : ''}
    <div class="brand">
      <span class="name">${escapeHtml(gameName)}</span>
      <span class="label">${escapeHtml(label)}</span>
    </div>
    ${hookHtml ? `<div class="hook">${hookHtml}</div>` : ''}
    ${date ? `<div class="date">${escapeHtml(date)}</div>` : ''}
  </div>
</body></html>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function run() {
  const entries = onlySlug
    ? manifest.filter((m) => m.slug === onlySlug)
    : manifest
  if (entries.length === 0) {
    console.error(onlySlug ? `No manifest entry for --slug ${onlySlug}` : 'Manifest is empty.')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })

  let ok = 0
  for (const m of entries) {
    const petAbs = join(PUBLIC, 'blog-heroes', m.game, `${m.slug}.png`)
    const petUri = dataUri(petAbs, 'image/png')
    if (!petUri) {
      console.log(`  ⚠ ${m.slug}: no pet scene at public/blog-heroes/${m.game}/${m.slug}.png — rendering placeholder`)
    }

    await page.setContent(
      html({ label: m.label, gameName: m.gameName, date: m.date, hook: m.hook, petUri, layout: m.layout }),
      { waitUntil: 'networkidle' },
    )
    // Give webfonts a beat to paint before the shot.
    await page.evaluate(() => document.fonts.ready)

    const outDir = join(PUBLIC, 'blog-og', m.game)
    mkdirSync(outDir, { recursive: true })
    const out = join(outDir, `${m.slug}.png`)
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } })
    console.log(`  ✓ ${m.slug}  → public/blog-og/${m.game}/${m.slug}.png`)
    ok++
  }

  await browser.close()
  console.log(`\nDone. ${ok} image(s) rendered.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
