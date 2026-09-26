/**
 * The content hub must not overclaim how prices are sourced, and must not
 * describe payout timing or custody of funds.
 *
 * Two problems this pins:
 *
 *  1. PRICING. Hub copy claimed values came from "completed sales" / "completed
 *     DropMarket sales". We price ACTIVE third-party listings from reputable
 *     sellers; there is no completed-sale history behind these numbers. It was
 *     a factual overclaim on the hero, footer, FAQ, methodology and metadata.
 *
 *  2. PROTECTION. Copy said "the seller is paid only after you confirm
 *     delivery" (and, seller-side, "you're paid on delivery"). DropMarket acts
 *     as the seller's commercial agent — it does not hold buyer funds in escrow
 *     — so describing payout timing or where money sits contradicts the model.
 *     Say what the buyer gets: the outcome and the refund.
 *
 * Scope is the shared content hub, where one template serves every game. The
 * marketplace/listing surfaces are out of scope for this guard.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { HUB_COPY } from '@/lib/content/theme'

const ROOT = process.cwd()

/** Hub surfaces: one template, every game. */
const HUB_PATHS = [
  'src/lib/content/theme.ts',
  'src/components/content',
  'src/app/(marketplace)/[gameSlug]/values',
  'src/app/(marketplace)/[gameSlug]/calculator',
  'src/app/(marketplace)/[gameSlug]/neon-calculator',
  'src/app/(marketplace)/[gameSlug]/price-index',
  'src/app/(marketplace)/[gameSlug]/blog',
  'src/app/(marketplace)/[gameSlug]/sell',
]

function walk(p: string): string[] {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [abs]
  return fs
    .readdirSync(abs)
    .flatMap((child) => walk(path.join(p, child)))
    .filter((f) => /\.tsx?$/.test(f))
}

const FILES = HUB_PATHS.flatMap(walk)

/**
 * Strip comments so the rules apply to USER-VISIBLE strings only. The rule
 * documentation itself necessarily quotes the banned phrases.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

describe('hub copy: pricing claims', () => {
  it('never claims values come from completed sales', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = code(fs.readFileSync(file, 'utf8'))
      const stripped = src
        // "not completed sales" is the correct NEGATION and is allowed.
        .replace(/not completed sales/gi, '')
        // A table row LABEL that displays a real completed_sale_count is a
        // fact about the data, not a claim about where prices come from.
        // Allowed; the sourcing claims below are not.
        .replace(/label="Completed sales"/g, '')
      if (
        /(from|based on|derived from|pulled from|sourced from|prices? (are|come)[^.]{0,40})\s*(real\s+)?completed (DropMarket )?sales/i.test(
          stripped,
        ) ||
        /completed DropMarket sales/i.test(stripped)
      ) {
        offenders.push(path.relative(ROOT, file))
      }
    }
    expect(offenders, `hub files claiming "completed sales"`).toEqual([])
  })
})

describe('hub copy: never describe payout timing or custody', () => {
  const BANNED = [
    /paid only after you confirm/i,
    /paid out only after/i,
    /\bpaid on delivery\b/i,
    /\bescrow\b/i,
    /we hold (your )?funds/i,
    /funds are held/i,
    /holding funds/i,
  ]

  it.each(BANNED.map((r) => [String(r)] as const))(
    'no hub string matches %s',
    (pattern) => {
      const re = BANNED.find((r) => String(r) === pattern)!
      const offenders: string[] = []
      for (const file of FILES) {
        if (re.test(code(fs.readFileSync(file, 'utf8')))) {
          offenders.push(path.relative(ROOT, file))
        }
      }
      expect(offenders).toEqual([])
    },
  )
})

describe('shared copy slots', () => {
  it('states protection as an outcome, with no payout mechanics', () => {
    expect(HUB_COPY.safedrop).toContain('exactly what you ordered')
    expect(HUB_COPY.safedrop).toContain('money back')
    for (const re of [/paid/i, /escrow/i, /hold/i, /deliver/i]) {
      expect(HUB_COPY.safedrop, `safedrop copy mentions ${re}`).not.toMatch(re)
      expect(HUB_COPY.safedropShort).not.toMatch(re)
    }
  })

  it('describes pricing as live listings from reputable sellers', () => {
    expect(HUB_COPY.pricingBasis).toMatch(/live marketplace listings/i)
    expect(HUB_COPY.pricingBasis).toMatch(/reputable/i)
    expect(HUB_COPY.pricingBasis).not.toMatch(/completed sale/i)
    expect(HUB_COPY.pricingQualifier).not.toMatch(/completed sale/i)
  })

  it('is used by the shared components rather than copied per game', () => {
    // A future game must inherit these, not re-declare them.
    for (const file of [
      'src/components/content/HubBuyCta.tsx',
      'src/components/content/ValuesBuyModule.tsx',
    ]) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(src, `${file} should read HUB_COPY`).toContain('HUB_COPY')
    }
    // HubFooter states the same promise as literal text rather than a `{expr}`:
    // an interpolation emits its own text node, so React writes a `<!-- -->`
    // separator into the HTML. Harmless, but pointless here — the sentence has
    // no per-game part. The wording is still pinned.
    const footer = fs.readFileSync(
      path.join(ROOT, 'src/components/content/HubFooter.tsx'),
      'utf8',
    )
    expect(footer).toMatch(/get exactly what you ordered, or your money\s+back\./)
  })
})
