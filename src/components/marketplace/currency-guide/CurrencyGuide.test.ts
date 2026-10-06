import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getCurrencyGuide, type OurPrices } from '@/lib/currency-guides'
import { CurrencyGuide, formatAmount, splitLead, type CurrencyGuideProps } from './CurrencyGuide'

vi.stubGlobal('React', React)

const links = { game: [{ href: '/roblox/items', label: 'Roblox Items' }], related: [{ href: '/fortnite/buy-vbucks', label: 'Fortnite V-Bucks' }] }
const ours: OurPrices = { kind: 'flexible', granularity: 'unit', offers: [{ pricePerUnit: 0.0052, minQty: 1000, stock: 10_000 }] }

function render(slug: string, extra: Partial<CurrencyGuideProps> = {}) {
  const guide = getCurrencyGuide(slug)!
  return renderToStaticMarkup(
    createElement(CurrencyGuide, { guide, gameName: 'Roblox', ours, reviews: null, links, ...extra }),
  )
}

describe('CurrencyGuide server HTML', () => {
  it('has one H2 and every section, folded ones included, in the HTML', () => {
    const html = render('roblox')
    expect(html.match(/<h2/g)).toHaveLength(1)
    expect(html).toContain('Robux Guide: Prices, Delivery and Safety')
    for (const t of [
      'What Is Robux and What Can You Buy With It?',
      'Robux Prices: Official Store vs DropMarket',
      'How Robux Delivery Works',
      'Is It Safe to Buy Robux on DropMarket?',
      'Why Is My Robux Pending?',
      'More Roblox on DropMarket',
    ]) {
      expect(html).toContain(t.replace(/'/g, '&#x27;'))
    }
    expect(html).toContain('Create a game pass in one of your Roblox experiences')
    expect(html).toContain('Read the Full Robux Guide')
  })

  it('price table: live price, saving, and "—" where no offer fits', () => {
    const html = render('roblox')
    expect(html).toContain('$5.20')
    expect(html).toContain('Save 47%')
    expect(html).toContain('No live offer for this amount')
    expect(html).toContain('Biggest Saving')
  })

  it('"No Password Needed" only when the sheet says so', () => {
    expect(render('roblox')).toContain('No Password Needed')
    const vbucks = render('fortnite')
    expect(vbucks).not.toContain('No Password Needed')
    expect(vbucks).toContain('change your password once the order is complete')
  })

  it('no rating below the review threshold; the real one when passed', () => {
    expect(render('roblox')).not.toMatch(/Rated \d/)
    expect(render('roblox', { reviews: { count: 23, average: 4.84 } })).toContain('Rated 4.8 out of 5')
  })

  it('games whose publisher bans buying the currency get no "Yes, it\'s safe"', () => {
    const html = render('gta-v', { rmtPublisher: 'Rockstar' })
    expect(html).not.toContain('Yes. Every order is covered')
    expect(html).toContain('Rockstar&#x27;s rules don&#x27;t allow buying GTA$')
  })

  it('no official prices (Tarkov): an honest line, no table', () => {
    const html = render('escape-from-tarkov', {
      ours: { kind: 'flexible', granularity: 'million', offers: [{ pricePerUnit: 0.49, minQty: 2, stock: 1392 }] },
    })
    expect(html).not.toContain('<table')
    expect(html).toContain('no official cash price list for Roubles')
    expect(html).toContain('$0.49 per 1M Roubles')
  })

  it('the not-affiliated line names the trademark owner', () => {
    expect(render('roblox')).toContain('Roblox and Robux are trademarks of Roblox Corporation')
    const vbucks = render('fortnite')
    expect(vbucks).toContain('trademarks of Epic Games, Inc. DropMarket')
    expect(vbucks).not.toContain('Inc..')
    expect(render('blade-ball')).toContain('Roblox is a trademark of Roblox Corporation. DropMarket is an independent marketplace')
  })

  it('never uses escrow / funds-held / buyer-protection wording', () => {
    for (const slug of ['roblox', 'fortnite', 'gta-v']) {
      const html = render(slug)
      expect(html).not.toMatch(/escrow|funds (are )?held|buyer protection/i)
    }
  })
})

describe('helpers', () => {
  it('formatAmount puts GTA$ in front', () => {
    expect(formatAmount('Robux', 1000)).toBe('1,000 Robux')
    expect(formatAmount('GTA$', 250000)).toBe('GTA$250,000')
  })
  it('splitLead keeps URLs inside the first sentence', () => {
    expect(splitLead('Redeem it at fortnite.com/vbuckscard. Then check.')).toEqual(['Redeem it at fortnite.com/vbuckscard.', 'Then check.'])
    expect(splitLead('One sentence only.')).toEqual(['One sentence only.', ''])
  })
})
