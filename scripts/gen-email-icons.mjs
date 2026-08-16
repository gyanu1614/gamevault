/**
 * Render REAL Tabler outline icons to email PNGs (forest light + light-stroke dark).
 * Source: node_modules/@tabler/icons/icons/outline/<name>.svg
 * Output: gamevault/public/email-icons/<key>.png  (+ <key>-dark.png)
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const TABLER = '/Users/gyanendra/gamevault/node_modules/@tabler/icons/icons/outline'
const OUT = '/Users/gyanendra/gamevault/public/email-icons'
mkdirSync(OUT, { recursive: true })

const FOREST = '#14432A'
const LIGHT = '#EAEEE2'

// email-key → tabler svg filename
const MAP = {
  sale: 'confetti',
  confirm: 'mail',
  ordered: 'circle-check',
  paid: 'circle-check',
  delivered: 'package',
  refunded: 'coin',
  payout: 'mood-dollar',
  message: 'message-2',
  application: 'file-text',
  review: 'zoom-check',
  approved: 'rosette-discount-check',
  rejected: 'clipboard-text',
  info: 'file-text',
  listinglive: 'bolt',
  changes: 'pencil',
  reset: 'key',
  magic: 'lock-open',
  emailchange: 'mail',
  invite: 'hand-stop',
  welcome: 'hand-stop',
  founding: 'rocket',
  notice: 'speakerphone',
  star: 'star',
  dispute: 'scale',
}

function recolor(svg, color) {
  // Tabler outline SVGs use stroke="currentColor". Force our color + keep 2px stroke.
  return svg
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/<svg /, '<svg ') // no-op keep
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 120, height: 120 }, deviceScaleFactor: 1 })

let count = 0, missing = []
for (const [key, file] of Object.entries(MAP)) {
  let raw
  try {
    raw = readFileSync(`${TABLER}/${file}.svg`, 'utf8')
  } catch {
    missing.push(`${key} (${file}.svg)`)
    continue
  }
  for (const [suffix, color] of [['', FOREST], ['-dark', LIGHT]]) {
    let svg = recolor(raw, color)
    // Ensure explicit 120px render size
    svg = svg.replace(/width="24"/, 'width="120"').replace(/height="24"/, 'height="120"')
    const html = `<!doctype html><html><head><style>*{margin:0;padding:0}body{background:transparent}</style></head><body>${svg}</body></html>`
    await page.setContent(html, { waitUntil: 'load' })
    const el = await page.$('svg')
    const buf = await el.screenshot({ omitBackground: true })
    writeFileSync(`${OUT}/${key}${suffix}.png`, buf)
    count++
  }
}
await browser.close()
console.log(`Generated ${count} Tabler icon PNGs → ${OUT}`)
if (missing.length) console.log('MISSING:', missing.join(', '))
