import { describe, expect, it } from 'vitest'
import {
  DISCORD_MAX_CHARS,
  MAX_ENTRIES,
  MAX_QTY,
  addItem,
  decodeInventory,
  encodeInventory,
  fmtUsd,
  inventoryLines,
  inventoryTotals,
  packCatalogue,
  rarityBreakdown,
  removeItem,
  setQty,
  topItems,
  tradeAdText,
  unpackCatalogue,
  type InventoryItem,
} from './inventory'

const BASE = 'https://x.supabase.co/storage/v1/object/public/values-items/murder-mystery-2/'

const RAW = [
  { slug: 'harvester', name: 'Harvester', rarity: 'Ancient', imageUrl: `${BASE}harvester.webp`, cheapestUsd: 65, marketUsd: 70.5 },
  { slug: 'chroma-fang', name: 'Chroma Fang', rarity: 'Chroma', imageUrl: `${BASE}chroma-fang.webp`, cheapestUsd: 12.1, marketUsd: 13 },
  { slug: 'icebreaker', name: 'Icebreaker', rarity: 'Godly', imageUrl: 'https://elsewhere.test/ice.png', cheapestUsd: 0.1, marketUsd: null },
  { slug: 'seer', name: 'Seer', rarity: 'Godly', imageUrl: null, cheapestUsd: 0.2, marketUsd: 0.25 },
  { slug: 'unpriced', name: 'Unpriced', rarity: 'Godly', imageUrl: null, cheapestUsd: null, marketUsd: null },
  { slug: 'common-knife', name: 'Common Knife', rarity: null, imageUrl: null, cheapestUsd: 0.07, marketUsd: 0.08 },
]

const items = unpackCatalogue(packCatalogue(RAW, BASE))
const bySlug = new Map<string, InventoryItem>(items.map((i) => [i.slug, i]))
const known = (s: string) => bySlug.has(s)

describe('packed catalogue', () => {
  it('drops unpriced items, sorts most valuable first and round-trips', () => {
    const packed = packCatalogue(RAW, BASE)
    expect(packed.rows.map((r) => r[0])).toEqual(['harvester', 'chroma-fang', 'seer', 'icebreaker', 'common-knife'])
    // standard art collapses to 1, no art to 0, a foreign URL stays whole
    expect(packed.rows[0]![3]).toBe(1)
    expect(packed.rows.find((r) => r[0] === 'seer')![3]).toBe(0)
    expect(packed.rows.find((r) => r[0] === 'icebreaker')![3]).toBe('https://elsewhere.test/ice.png')
    expect(bySlug.get('harvester')).toEqual(RAW[0])
    expect(bySlug.get('icebreaker')!.marketUsd).toBe(0.1) // no market → cheapest
    expect(bySlug.get('common-knife')!.rarity).toBeNull()
    expect(bySlug.has('unpriced')).toBe(false)
  })

  it('is compact: one short tuple per item', () => {
    const json = JSON.stringify(packCatalogue(RAW, BASE))
    expect(json).not.toContain(`${BASE}harvester`)
    expect(json.length).toBeLessThan(400)
  })
})

describe('entries', () => {
  it('adds to the top, bumps an existing line and caps the quantity', () => {
    let e = addItem([], 'harvester')
    e = addItem(e, 'seer')
    expect(e.map((x) => x.slug)).toEqual(['seer', 'harvester'])
    e = addItem(e, 'harvester', 2)
    expect(e.find((x) => x.slug === 'harvester')!.qty).toBe(3)
    e = setQty(e, 'harvester', 5000)
    expect(e.find((x) => x.slug === 'harvester')!.qty).toBe(MAX_QTY)
    e = setQty(e, 'harvester', 0)
    expect(e.map((x) => x.slug)).toEqual(['seer'])
    expect(removeItem(e, 'seer')).toEqual([])
    expect(setQty([{ slug: 'seer', qty: 1 }], 'seer', Number.NaN)).toEqual([])
  })

  it('caps the number of distinct items', () => {
    let e: { slug: string; qty: number }[] = []
    for (let i = 0; i < MAX_ENTRIES + 5; i++) e = addItem(e, `item-${i}`)
    expect(e).toHaveLength(MAX_ENTRIES)
  })
})

describe('hash codec', () => {
  it('round-trips', () => {
    const e = [
      { slug: 'harvester', qty: 2 },
      { slug: 'seer', qty: 1 },
    ]
    const h = encodeInventory(e)
    expect(h).toBe('i=harvester:2,seer:1')
    expect(decodeInventory(`#${h}`, known)).toEqual(e)
    expect(encodeInventory([])).toBe('')
  })

  it('is safe on invalid input', () => {
    expect(decodeInventory(null)).toEqual([])
    expect(decodeInventory('')).toEqual([])
    expect(decodeInventory('#nope')).toEqual([])
    expect(decodeInventory('#i=%E0%A4%A')).toEqual([]) // malformed escape
    expect(
      decodeInventory('#i=harvester:0,SEER:3,<script>:1,ghost:2,harvester:abc,chroma-fang,,seer:2', known),
    ).toEqual([
      { slug: 'seer', qty: 5 }, // case-folded and merged
      { slug: 'chroma-fang', qty: 1 }, // bare slug = 1
    ])
    expect(decodeInventory('#x=1&i=harvester:9999999', known)).toEqual([])
    expect(decodeInventory('#x=1&i=harvester:99999', known)).toEqual([{ slug: 'harvester', qty: MAX_QTY }])
    expect(decodeInventory('i=harvester:600,harvester:600', known)).toEqual([{ slug: 'harvester', qty: MAX_QTY }])
  })

  it('caps the item count and the input length', () => {
    const many = Array.from({ length: MAX_ENTRIES + 50 }, (_, i) => `s${i}:1`).join(',')
    expect(decodeInventory(`i=${many}`)).toHaveLength(MAX_ENTRIES)
    expect(decodeInventory(`i=${'a'.repeat(50_000)}`)).toEqual([])
  })
})

describe('maths', () => {
  const entries = [
    { slug: 'seer', qty: 3 },
    { slug: 'harvester', qty: 1 },
    { slug: 'ghost', qty: 4 },
    { slug: 'chroma-fang', qty: 2 },
    { slug: 'common-knife', qty: 10 },
  ]
  const lines = inventoryLines(entries, bySlug)

  it('totals in cents (no float drift) and skips unknown items', () => {
    expect(lines.map((l) => l.item.slug)).toEqual(['seer', 'harvester', 'chroma-fang', 'common-knife'])
    const t = inventoryTotals(lines)
    // 0.2×3 + 65 + 12.1×2 + 0.07×10 = 0.60 + 65 + 24.20 + 0.70
    expect(t.cheapestUsd).toBe(90.5)
    // 0.25×3 + 70.5 + 13×2 + 0.08×10 = 0.75 + 70.5 + 26 + 0.80
    expect(t.marketUsd).toBe(98.05)
    expect(t.count).toBe(16)
    expect(t.unique).toBe(4)
    expect(inventoryTotals([])).toEqual({ cheapestUsd: 0, marketUsd: 0, count: 0, unique: 0 })
  })

  it('breaks the total down by rarity, rarest first, unrated last', () => {
    const b = rarityBreakdown(lines, ['Chroma', 'Ancient', 'Godly'])
    expect(b.map((r) => [r.rarity, r.count, r.cheapestUsd])).toEqual([
      ['Chroma', 2, 24.2],
      ['Ancient', 1, 65],
      ['Godly', 3, 0.6],
      ['Other', 10, 0.7],
    ])
    expect(b.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10)
    expect(rarityBreakdown([], ['Godly'])).toEqual([])
  })

  it('picks the most valuable items by one copy', () => {
    expect(topItems(lines).map((l) => l.item.slug)).toEqual(['harvester', 'chroma-fang', 'seer'])
    expect(topItems(lines, 1)).toHaveLength(1)
  })
})

describe('trade ad', () => {
  const url = 'https://dropmarket.gg/murder-mystery-2/inventory'

  it('is Discord markdown: bold header, priced lines, total, link', () => {
    const lines = inventoryLines(
      [
        { slug: 'chroma-fang', qty: 2 },
        { slug: 'harvester', qty: 1 },
      ],
      bySlug,
    )
    const text = tradeAdText({ lines, totals: inventoryTotals(lines), shortName: 'MM2', pageUrl: url, hash: 'i=chroma-fang:2,harvester:1' })
    expect(text).toBe(
      [
        '**MM2 Inventory Worth $89.20**',
        '- Harvester: $65.00',
        '- Chroma Fang x2: $24.20',
        '**Total: $89.20** (3 items, live USD prices)',
        `See it: ${url}#i=chroma-fang:2,harvester:1`,
      ].join('\n'),
    )
    expect(tradeAdText({ lines: [], totals: inventoryTotals([]), shortName: 'MM2', pageUrl: url, hash: '' })).toBe('')
  })

  it('lists ten lines, counts the rest, escapes markdown and stays under 2,000 characters', () => {
    const many: InventoryItem[] = Array.from({ length: MAX_ENTRIES }, (_, i) => ({
      slug: `a-very-long-item-slug-number-${i}`,
      name: i === 0 ? 'Star*Gun_' : `Item ${i}`,
      rarity: 'Godly',
      imageUrl: null,
      cheapestUsd: 1000 - i,
      marketUsd: 1000 - i,
    }))
    const map = new Map(many.map((m) => [m.slug, m]))
    const entries = many.map((m) => ({ slug: m.slug, qty: 1 }))
    const lines = inventoryLines(entries, map)
    const text = tradeAdText({ lines, totals: inventoryTotals(lines), shortName: 'MM2', pageUrl: url, hash: encodeInventory(entries) })
    expect(text.length).toBeLessThanOrEqual(DISCORD_MAX_CHARS)
    expect(text).toContain('- Star\\*Gun\\_: $1,000.00')
    expect(text).toContain(`- + ${MAX_ENTRIES - 10} more items`)
    expect(text.endsWith(`See it: ${url}`)).toBe(true) // the long hash link was dropped
  })

  it('formats dollars', () => {
    expect(fmtUsd(4045.99)).toBe('$4,045.99')
    expect(fmtUsd(0.5)).toBe('$0.50')
  })
})
