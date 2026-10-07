import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getCurrencyGuide, type OurPrices } from '@/lib/currency-guides'
import { CurrencyGuide, formatAmount, guideTitle, pageCopy, splitLead, type CurrencyGuideProps } from './CurrencyGuide'

vi.stubGlobal('React', React)
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, undefined] }))
vi.mock('embla-carousel-auto-scroll', () => ({ default: () => ({}) }))

const ours: OurPrices = { kind: 'flexible', granularity: 'unit', offers: [{ pricePerUnit: 0.0052, minQty: 100, stock: 100_000 }] }
const categories = [
  { href: '/roblox/buy-robux', name: 'Robux', type: 'currency' },
  { href: '/roblox/buy-items', name: 'Items', type: 'items' },
  { href: '/roblox/buy-accounts', name: 'Accounts', type: 'account' },
]
const currencyPages = [
  { gameSlug: 'blade-ball', gameName: 'Blade Ball', currencyName: 'Blade Ball Tokens', href: '/blade-ball/buy-currency', iconUrl: null, offers: 2 },
]

function render(slug: string, extra: Partial<CurrencyGuideProps> = {}) {
  const guide = getCurrencyGuide(slug)!
  return renderToStaticMarkup(
    createElement(CurrencyGuide, { guide, gameName: 'Roblox', ours, categories, currencyPages, ...extra }),
  )
}

describe('CurrencyGuide (on-page layout)', () => {
  const html = render('roblox')

  it('one H2, the "<Game> <Currency> Guide" title, no table of contents', () => {
    expect(html.match(/<h2/g)).toHaveLength(1)
    expect(html).toContain('Roblox Robux Guide: Prices, Delivery and Safety')
    expect(html).not.toContain('In This Guide')
  })

  it('every section is in the HTML, without "DropMarket" in the headings', () => {
    for (const t of ['What Is Robux?', 'How Much Do You Save on Robux?', 'How Robux Delivery Works', 'Is It Safe to Buy Robux?', 'Why Is My Robux Pending?', 'More Roblox', 'Roblox Games Currencies']) {
      expect(html).toContain(t)
    }
    expect(html.match(/<h3[^>]*>[^<]*DropMarket/g)).toBeNull()
  })

  it('links the other Roblox currencies from "What Is Robux?"', () => {
    expect(html).toContain('href="/99-nights-in-the-forest/buy-currency"')
    expect(html).toContain('Tokens in Blade Ball')
  })

  it('compares exactly the five chosen packs and quotes the 11,000 saving', () => {
    const rows = html.match(/<th scope="row"[^>]*>([^<]+)<\/th>/g)!.map((r) => r.replace(/<[^>]+>/g, ''))
    expect(rows).toEqual(['500', '1,000', '5,250', '11,000', '24,000'])
    // 11,000 × $0.0052 = $57.20 against $99.99 → about $43.
    expect(html).toContain('You save about $43 on 11,000 Robux')
  })

  it('More Roblox: the hub and categories with offers, never the currency page itself', () => {
    expect(html).toContain('Roblox Marketplace')
    expect(html).toContain('href="/roblox/buy-items"')
    expect(html).not.toMatch(/href="\/roblox\/buy-robux"/)
  })

  it('a guide without hand-written copy still renders from its facts', () => {
    const fortnite = getCurrencyGuide('fortnite')!
    const p = pageCopy(fortnite)
    expect(p.subtitle.length).toBeGreaterThan(20)
    expect(p.delivery.steps.length).toBeGreaterThan(0)
  })
})

describe('helpers', () => {
  it('guideTitle never repeats the game name', () => {
    expect(guideTitle('Roblox', 'Robux')).toBe('Roblox Robux Guide: Prices, Delivery and Safety')
    expect(guideTitle('Blade Ball', 'Blade Ball Tokens')).toBe('Blade Ball Tokens Guide: Prices, Delivery and Safety')
  })
  it('formatAmount and splitLead', () => {
    expect(formatAmount('Robux', 1000)).toBe('1,000 Robux')
    expect(formatAmount('GTA$', 250000)).toBe('GTA$250,000')
    expect(splitLead('One. Two three.')).toEqual(['One.', 'Two three.'])
  })
})
