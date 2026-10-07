import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getCurrencyGuide, type OurPrices } from '@/lib/currency-guides'
import { CurrencyGuide, formatAmount, guideTitle, pageCopy, splitLead, trademarkLine, type CurrencyGuideProps } from './CurrencyGuide'

vi.stubGlobal('React', React)

const ours: OurPrices = { kind: 'flexible', granularity: 'unit', offers: [{ pricePerUnit: 0.0052, minQty: 100, stock: 100_000 }] }
const related = [
  { href: '/roblox/buy-items', label: 'Roblox Items', type: 'items' },
  { href: '/roblox/buy-accounts', label: 'Roblox Accounts', type: 'account' },
  { href: '/adopt-me/buy-items', label: 'Adopt Me Items', type: 'items' },
]

function render(slug: string, extra: Partial<CurrencyGuideProps> = {}) {
  const guide = getCurrencyGuide(slug)!
  return renderToStaticMarkup(
    createElement(CurrencyGuide, { guide, gameName: 'Roblox', ours, related, ...extra }),
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
    for (const t of ['How Much Do You Save on Robux?', 'How Robux Delivery Works', 'Is It Safe to Buy Robux?', 'More Roblox Games']) {
      expect(html).toContain(t)
    }
    expect(html.match(/<h3[^>]*>[^<]*DropMarket/g)).toBeNull()
    // The pending question moved to the FAQ.
    expect(html).not.toContain('Why Is My Robux Pending?')
  })

  it('the title\'s subtitle says what Robux is and links the other Roblox currencies', () => {
    expect(html).toContain('Robux is the money of Roblox')
    expect(html).not.toContain('What Is Robux?')
    expect(html).toContain('href="/99-nights-in-the-forest/buy-currency"')
    expect(html).toContain('Tokens in Blade Ball')
  })

  it('compares exactly the five chosen packs and quotes the 11,000 saving', () => {
    const rows = html.match(/<th scope="row"[^>]*>([^<]+)<\/th>/g)!.map((r) => r.replace(/<[^>]+>/g, ''))
    expect(rows).toEqual(['500 Robux', '1,000 Robux', '5,250 Robux', '11,000 Robux', '24,000 Robux'])
    // 11,000 × $0.0052 = $57.20 against $99.99 → about $43.
    expect(html).toContain('You save about $43 on 11,000 Robux')
  })

  it('More Roblox Games: one links section, this game first, then other games', () => {
    expect(html).toContain('href="/roblox/buy-items"')
    expect(html).toContain('Adopt Me Items')
    expect(html).not.toContain('Roblox Games Currencies')
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
  it('trademarkLine names the marks and says independent, not affiliated, sponsored or endorsed', () => {
    expect(trademarkLine('Roblox Corporation', 'Roblox', 'Robux')).toBe(
      "Roblox and Robux are trademarks of Roblox Corporation. DropMarket is independent and isn't affiliated with, sponsored or endorsed by Roblox Corporation.",
    )
    expect(trademarkLine('Epic Games, Inc.', 'Fortnite', 'V-Bucks')).toContain('trademarks of Epic Games, Inc. DropMarket')
  })
  it('formatAmount and splitLead', () => {
    expect(formatAmount('Robux', 1000)).toBe('1,000 Robux')
    expect(formatAmount('GTA$', 250000)).toBe('GTA$250,000')
    expect(splitLead('One. Two three.')).toEqual(['One.', 'Two three.'])
  })
})
