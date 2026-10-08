import { describe, it, expect } from 'vitest'
import { fitTitle, fitTitleText, fitDescription, seoMeta, shownTitle, TITLE_MAX, DESC_MAX } from './fit'

describe('fitTitle (shown title ≤ 60, brand included when it fits)', () => {
  it('keeps the brand suffix when it fits', () => {
    expect(shownTitle(fitTitle('Seller Fees'))).toBe('Seller Fees | DropMarket')
  })
  it('drops the brand before any words', () => {
    expect(shownTitle(fitTitle('Cookiecane Value in MM2 (October 2026) — Price in USD'))).toBe(
      'Cookiecane Value in MM2 (October 2026) — Price in USD',
    )
  })
  it('then drops a trailing " — …" segment, then a "(…)", then words', () => {
    expect(fitTitleText('MM2 Value List (October 2026) — Murder Mystery 2 Prices in USD')).toBe('MM2 Value List (October 2026)')
    expect(fitTitleText('Steal a Brainrot WFL Calculator (October 2026) — Win, Fair or Loss Trade Checker')).toBe(
      'Steal a Brainrot WFL Calculator (October 2026)',
    )
    const long = 'A very long title with no separators that keeps going well past the sixty character line'
    const t = fitTitleText(long)
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(t.endsWith('…')).toBe(true)
  })
  it('fits an absolute title without adding the brand', () => {
    expect(fitTitle({ absolute: 'DropMarket: Buy & Sell Game Accounts, Items & Currency' })).toEqual({
      absolute: 'DropMarket: Buy & Sell Game Accounts, Items & Currency',
    })
  })
})

describe('fitDescription (≤ 155, whole sentences or clauses, never mid-bracket)', () => {
  it('leaves a short description alone', () => {
    expect(fitDescription('Short and sweet.')).toBe('Short and sweet.')
  })
  it('ends on a whole sentence when one is long enough', () => {
    const d = fitDescription(
      "MM2 Christmas 2016 ran from Dec 25, 2016 to Jan 13, 2017. Players salvaged weapons into toy parts, crafted and wrapped toys. Then they traded them for prizes and a lot more besides.",
    )!
    expect(d).toBe('MM2 Christmas 2016 ran from Dec 25, 2016 to Jan 13, 2017. Players salvaged weapons into toy parts, crafted and wrapped toys.')
  })
  it('falls back to a clause, closed with a full stop', () => {
    const d = fitDescription(
      'How much is Cookiecane worth in Murder Mystery 2? It sells for about $0.48 from reputable sellers, across 29 live listings — real US dollars, updated daily, not value points.',
    )!
    expect(d.length).toBeLessThanOrEqual(DESC_MAX)
    expect(d.endsWith('.')).toBe(true)
  })
  it('never ends inside brackets', () => {
    const d = fitDescription(
      'How many pets to make a Neon or Mega Neon in Adopt Me, and what it costs. See the cash cost to build (4 pets for a Neon, 16 for a Mega) versus buying the finished pet.',
    )!
    expect((d.match(/\(/g) ?? []).length).toBe((d.match(/\)/g) ?? []).length)
    expect(d.length).toBeLessThanOrEqual(DESC_MAX)
  })
})

describe('seoMeta', () => {
  it('fits title, description and their social copies', () => {
    const m = seoMeta({
      title: 'Steal a Brainrot WFL Calculator (October 2026) — Win, Fair or Loss Trade Checker',
      description: 'x '.repeat(200),
      openGraph: { title: 'y'.repeat(120), description: 'z '.repeat(200) },
      alternates: { canonical: '/x' },
    })
    expect(shownTitle(m.title).length).toBeLessThanOrEqual(TITLE_MAX)
    expect((m.description as string).length).toBeLessThanOrEqual(DESC_MAX)
    expect((m.openGraph!.title as string).length).toBeLessThanOrEqual(70)
    expect(m.alternates).toEqual({ canonical: '/x' })
  })
})
