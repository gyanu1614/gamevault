/**
 * Fee engine PR 5 — no seller-fee NUMBER may live in marketing copy
 * (docs/design/fee-engine.md §7.3, §9 A7; audit fee-inventory.md Part B).
 *
 * The 2026-09-20 inventory found 154 display sites and 22 mismatches — "5–10%"
 * on the homepage while accounts were 15–20%, "2% lower fees" for a 2-point
 * discount, "for life" for a 12-month programme. Every hard-coded rate was
 * wrong or became wrong. The durable fix is this test: the surfaces below may
 * describe fees qualitatively ("lowest seller fees", "−0.5 pts per rank") or
 * read them from the resolver at render time, but a literal
 * "<digits>%" — or the words commission / seller fee / platform fee within
 * a few characters of a digit — fails the build.
 *
 * Allow-list entries carry a REASON, like the caching guard's GRANDFATHERED:
 * a legitimate non-commission percentage is exempted by name, never by
 * loosening the regex. No DB.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LEGAL_DOCS } from '@/lib/legal/documents'
import { formatScheduleDateUtc, type PublicFeeSchedule, type PublicWithdrawalTerms } from '@/lib/fees/public-rates'

// tsconfig's `jsx: preserve` leaves vitest on the classic transform, which
// needs React in scope; the page (like every Next page) does not import it.
;(globalThis as { React?: typeof React }).React = React

// /sell/fees renders from these two reads; the tests below swap in fixtures.
const feeData = vi.hoisted(() => ({ schedule: null as unknown, terms: null as unknown }))
vi.mock('@/lib/fees/public-rates', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/fees/public-rates')>()
  return { ...real, getPublicFeeSchedule: async () => feeData.schedule, getPublicWithdrawalTerms: async () => feeData.terms }
})
vi.mock('next/link', () => ({ default: ({ children }: { children: unknown }) => children }))

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Marketing / SEO / notification surfaces that describe seller fees. */
const PINNED_FILES = [
  'src/features/home/pages/HomePage.tsx',
  'src/features/home/components/MobileHome.tsx',
  'src/app/browse/page.tsx',
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/page.tsx',
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/_GenericListingsClient.tsx',
  'src/app/(marketplace)/[gameSlug]/sell/page.tsx',
  'src/app/opengraph-image.tsx',
  'src/lib/seo/landingPages.ts',
  'src/lib/blog/posts.ts',
  'src/app/early-seller/page.tsx',
  'src/app/early-seller/_FoundingSignupClient.tsx',
  'src/app/founding/_components/FoundingRail.tsx',
  'src/lib/config/founding-seller.ts',
  'src/lib/email/index.ts',
  'src/lib/email/fee-notice.ts',
  'src/lib/discord/embeds.ts',
  'src/components/seller/tiers/TierCard.tsx',
  'src/app/account/tiers/page.tsx',
  // The one page that shows rates: every number on it comes from the
  // resolver at render time, so a literal in its source is a hard-coded rate.
  'src/app/(marketing)/sell/fees/page.tsx',
  'src/components/account/BecomeSellerBanner.tsx',
  'src/components/account/BecomeSellerCta.tsx',
]

/**
 * Exact matched text that is a legitimate NON-commission number, by file.
 * The reason is part of the entry.
 */
const ALLOWED: Record<string, Array<{ text: string; reason: string }>> = {
  'src/lib/email/index.ts': [
    { text: 'width="100%"', reason: 'HTML table width attributes in the email shell, not a fee' },
  ],
  'src/components/seller/tiers/TierCard.tsx': [
    { text: 'completion rate', reason: 'the rank REQUIREMENT "N% completion rate" is not a fee' },
  ],
  'src/features/home/components/MobileHome.tsx': [
    { text: 'width: ', reason: 'CSS percentage widths in inline styles' },
  ],
  'src/app/(marketing)/sell/fees/page.tsx': [
    { text: 'className="h-4 w-4" /> Seller Fees', reason: 'the eyebrow icon\'s size class sits next to the "Seller Fees" label, not a fee' },
  ],
}

const PCT_RE = /\b\d{1,2}(?:\.\d+)?\s*%/g
/**
 * A "<n>%" only counts when the line talks about fees — CSS widths, gradients
 * and progress bars also carry percentages and are not copy.
 */
const FEE_CONTEXT_RE = /\b(fees?|commission|take rate|pays?|charged?|charges|skim|cheaper|discount|lower)\b/i
/** "commission", "seller fee", "platform fee" adjacent to a digit within 12 chars. */
const FEE_WORD_NEAR_DIGIT_RE = /(?:commission|seller fees?|platform fees?)[^\n]{0,12}\d|\d[^\n]{0,12}(?:commission|seller fees?|platform fees?)/gi

function violations(file: string): string[] {
  const src = read(file)
  const allowed = ALLOWED[file] ?? []
  const out: string[] = []
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    // Skip comment lines — the guard is about what ships, not what is explained.
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    for (const re of [PCT_RE, FEE_WORD_NEAR_DIGIT_RE]) {
      if (re === PCT_RE && !FEE_CONTEXT_RE.test(line)) continue
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(line))) {
        const window = line.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
        if (allowed.some((a) => window.includes(a.text))) continue
        out.push(`${file}:${i + 1}: ${JSON.stringify(m[0])} in …${window.trim()}…`)
      }
    }
  })
  return out
}

describe('fee engine — marketing copy carries no seller-fee number', () => {
  for (const file of PINNED_FILES) {
    it(`${file} quotes no "<n>%" and no fee word next to a digit`, () => {
      expect(violations(file)).toEqual([])
    })
  }

  it('every allow-list entry still matches something (stale entries are removed, not kept)', () => {
    for (const [file, entries] of Object.entries(ALLOWED)) {
      const src = read(file)
      for (const e of entries) expect(src.includes(e.text), `${file}: allow-list "${e.text}" (${e.reason}) matches nothing any more`).toBe(true)
    }
  })

  it('the /fees legal document states rules, not numbers, in its seller-commission section', () => {
    const doc = LEGAL_DOCS.find((d) => d.slug === 'fees')
    expect(doc).toBeTruthy()
    const section = doc!.sections.find((s) => s.h === 'Seller commissions')
    expect(section, 'the Seller commissions section exists').toBeTruthy()
    const text = JSON.stringify(section!.blocks)
    expect(text).not.toMatch(PCT_RE)
    expect(text).toMatch(/\[Seller Fees page\]\(\/sell\/fees\)/)
  })

  // Checkout B3: /fees is the ONE page where buyer-fee numbers may appear —
  // but only the flat marketplace fee lives in the document; every
  // per-method processing figure is a table built from payment_method_fees
  // at render time (lib/fees/buyer-public-rates), never typed into copy.
  it('the /fees buyer section carries only the marketplace fee; per-method numbers come from the table', () => {
    const doc = LEGAL_DOCS.find((d) => d.slug === 'fees')!
    const section = doc.sections.find((s) => s.h === 'Buyer fee')
    expect(section, 'the Buyer fee section exists').toBeTruthy()
    const text = JSON.stringify(section!.blocks)
    const numbers = text.match(PCT_RE) ?? []
    expect(numbers, 'only the marketplace fee is a literal').toEqual(['2%'])
    expect(text).not.toMatch(/5%|processing fee of the greater/i)
    const page = read('src/app/(legal)/fees/page.tsx')
    expect(page).toMatch(/getPublicBuyerFees\(/)
    expect(page).toMatch(/buyerFeeTableBlock\(/)
  })

  it('no source file outside lib/fees re-declares the retired TS commission constants', () => {
    const retired = ['COMMISSION_PCT', 'ROBLOX_ECONOMY_GAMES', 'FOUNDING_DISCOUNT_PTS', 'PROMO_ZERO_FEE_GAMES']
    for (const file of PINNED_FILES) {
      const src = read(file)
      for (const name of retired) expect(src.includes(name), `${file} references ${name}`).toBe(false)
    }
  })
})

/**
 * /sell/fees — the per-game table carries the same dated "From" column as the
 * category table: same formatter (formatScheduleDateUtc, UTC), same header,
 * same rule (shown while a dated change moves a listed rate, gone once the
 * date has passed and `nextChange` is null). Rendered with react-dom/server
 * from fixture reads; no DB.
 */
describe('/sell/fees — per-game "From <date>" column mirrors the category table', () => {
  const START = '2026-10-07T00:00:00+00:00'
  const TERMS: PublicWithdrawalTerms = {
    methods: [], completionHoldHours: 24, disputeWindowDays: 7, minAccountAgeDays: 30, payoutFreezeHours: 48, windows: [], generatedAt: START,
  }
  const cat = (type: string, pct: number, nextPct: number | null) => ({ type, label: type, pct, nextPct })
  const pair = (gameName: string, categoryName: string, pct: number, nextPct: number | null, kind: 'base' | 'promo' = 'base', endsAt: string | null = null) => ({
    gameSlug: gameName.toLowerCase().replace(/\W+/g, '-'), gameName, categorySlug: categoryName.toLowerCase(), categoryName, type: 'currency', pct, nextPct, kind, endsAt,
  })
  const schedule = (over: Partial<PublicFeeSchedule>): PublicFeeSchedule => ({
    categories: [cat('currency', 5, null), cat('account', 12, 15)],
    overrides: [],
    ranks: [], rankFloorPct: 8, founding: { discountPct: 50, months: 12 }, noticeDays: 14,
    effectiveFrom: '2026-09-22T00:00:00+00:00', nextChange: START, generatedAt: START,
    ...over,
  })

  /** Header and body cells of every <table> on the page, in order. */
  async function renderTables(s: PublicFeeSchedule): Promise<Array<{ head: string[]; rows: string[][] }>> {
    feeData.schedule = s
    feeData.terms = TERMS
    const { default: SellerFeesPage } = await import('@/app/(marketing)/sell/fees/page')
    const html = renderToStaticMarkup(await SellerFeesPage())
    const text = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
    return html.split('<table').slice(1).map((t) => {
      const [thead, tbody = ''] = t.split('<tbody')
      return {
        head: [...thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1])),
        rows: [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1]))),
      }
    })
  }

  it('a dated per-game change shows "Rate now" + "From <date>" with the category table\'s formatter', async () => {
    const [category, perGame] = await renderTables(schedule({
      overrides: [
        pair('Grow a Garden', 'Sheckles', 5, 10),
        pair('Fortnite', 'Accounts', 12, 15),
        pair('Blox Fruits', 'Beli', 10, null),
        pair('EA Sports FC 26', 'FC Points', 0, null, 'promo', '2027-04-07T00:00:00+00:00'),
      ],
    }))
    const from = `From ${formatScheduleDateUtc(START)}`
    expect(from).toBe('From 7 October 2026')
    expect(category.head).toEqual(['Category', 'Rate now', from])
    expect(perGame.head).toEqual(['Game', 'Category', 'Rate now', from, 'Type'])
    expect(perGame.rows).toEqual([
      ['Grow a Garden', 'Sheckles', '5%', '10%', 'Standard'],
      ['Fortnite', 'Accounts', '12%', '15%', 'Standard'],
      ['Blox Fruits', 'Beli', '10%', 'unchanged', 'Standard'],
      ['EA Sports FC 26', 'FC Points', '0%', 'unchanged', `Promotion until ${formatScheduleDateUtc('2027-04-07T00:00:00+00:00')}`],
    ])
  })

  it('after the start date (no nextChange) both tables drop the column', async () => {
    const [category, perGame] = await renderTables(schedule({
      categories: [cat('currency', 5, null), cat('account', 15, null)],
      overrides: [pair('Grow a Garden', 'Sheckles', 10, null), pair('Fortnite', 'Accounts', 15, null)],
      nextChange: null,
    }))
    expect(category.head).toEqual(['Category', 'Rate'])
    expect(perGame.head).toEqual(['Game', 'Category', 'Rate', 'Type'])
    expect(perGame.rows).toEqual([
      ['Grow a Garden', 'Sheckles', '10%', 'Standard'],
      ['Fortnite', 'Accounts', '15%', 'Standard'],
    ])
  })

  it('the per-game column follows its own rows: a category-only change adds no per-game column', async () => {
    const [category, perGame] = await renderTables(schedule({ overrides: [pair('Blox Fruits', 'Beli', 10, null)] }))
    expect(category.head).toContain(`From ${formatScheduleDateUtc(START)}`)
    expect(perGame.head).toEqual(['Game', 'Category', 'Rate', 'Type'])
  })
})
