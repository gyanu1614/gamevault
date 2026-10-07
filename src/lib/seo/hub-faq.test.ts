import { describe, expect, it } from 'vitest'
import { buildHubFaq, pickOfficialPack } from './hub-faq'

describe('pickOfficialPack', () => {
  it('takes the priced pack closest to 1,000', () => {
    expect(
      pickOfficialPack([
        { amount: 400, usd: 4.99, where: 'roblox.com' },
        { amount: 1000, usd: 9.99, where: 'roblox.com' },
        { amount: 2000, usd: 19.99, where: 'roblox.com' },
      ]),
    ).toEqual({ amount: 1000, usd: 9.99, where: 'roblox.com' })
    expect(pickOfficialPack([{ amount: 800, usd: 8.99, where: 'Fortnite' }, { amount: 2800, usd: 22.99, where: 'Fortnite' }])?.amount).toBe(800)
    expect(pickOfficialPack([{ amount: 100, usd: null, where: 'x' }])).toBeNull()
    expect(pickOfficialPack(null)).toBeNull()
  })
})

describe('buildHubFaq', () => {
  const roblox = buildHubFaq({
    gameName: 'Roblox',
    currency: { name: 'Robux', fromLabel: '$0.0052/Robux', avgDelivery: '8 minutes', official: { amount: 1000, usd: 9.99, where: 'roblox.com (web)' }, lowPrice: 0.0052, unitsPerPrice: 1 },
    items: { fromLabel: '$4', count: 3 },
    accounts: { fromLabel: '$0.99', count: 1 },
    paymentMethods: ['USDT', 'Bitcoin', 'Pix'],
  })

  it('asks what people search, currency first', () => {
    expect(roblox.map((f) => f.q)).toEqual([
      'How much is 1,000 Robux in USD?',
      'Is it safe to buy Robux?',
      'How do I buy Robux?',
      "What's the cheapest way to buy Robux?",
      'Can I buy Roblox items with real money?',
      'Can I buy a Roblox account?',
    ])
  })

  it('answers with the live and official numbers', () => {
    expect(roblox[0].a).toBe(
      "1,000 Robux costs $9.99 on roblox.com, the official store. Sellers on DropMarket start from $0.0052/Robux, so the same 1,000 Robux costs you about $5.20. That's a saving of about 48%.",
    )
    expect(roblox[3].a).toContain('the same amount for about $5.20, almost half price')
    for (const f of roblox) expect(f.a.startsWith('On DropMarket')).toBe(false)
    expect(roblox).toHaveLength(6)
  })

  it('drops questions with nothing true to say', () => {
    const plain = buildHubFaq({ gameName: 'Valorant', currency: null, items: null, accounts: null, paymentMethods: [] })
    expect(plain.map((f) => f.q)).toEqual(['Is it safe to buy Valorant items?', 'How fast is Valorant delivery?'])
  })
})
