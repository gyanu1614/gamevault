import { describe, it, expect } from 'vitest'
import { ACCOUNT_ACCESS_ANSWER, applyGuideToFaq, passwordAnswer } from './faq'
import { CURRENCY_GUIDE_SLUGS, getCurrencyGuide } from './index'

/** The row most currency configs carry in the DB (category_configs.config.faq). */
const ADMIN_FAQ = [
  { q: 'How fast is delivery?', a: 'Most orders arrive in minutes.' },
  {
    q: 'Do I need to share my password?',
    a: "Never. Delivery happens via the game's own trade/gift system — only your username/handle is required.",
  },
]

describe('password FAQ rule', () => {
  it('keeps the admin answer when the guide says no password is needed', () => {
    expect(passwordAnswer('Never.', true)).toBe('Never.')
  })

  it('keeps the admin answer when there is no guide (unknown: the DB copy is not ours to rewrite)', () => {
    expect(passwordAnswer('Never.', undefined)).toBe('Never.')
    expect(applyGuideToFaq(ADMIN_FAQ, null)).toEqual(ADMIN_FAQ)
  })

  it('swaps in the honest answer when the guide says a login may be needed', () => {
    expect(passwordAnswer('Never.', false)).toBe(ACCOUNT_ACCESS_ANSWER)
    expect(ACCOUNT_ACCESS_ANSWER).not.toMatch(/\bnever\b/i)
    expect(ACCOUNT_ACCESS_ANSWER).toMatch(/SafeDrop Protection/)
  })

  it('the games whose password answer flips, per the fact sheets', () => {
    const flipped = CURRENCY_GUIDE_SLUGS.filter((slug) => {
      const faq = applyGuideToFaq(ADMIN_FAQ, getCurrencyGuide(slug))
      return faq[1].a === ACCOUNT_ACCESS_ANSWER
    }).sort()
    expect(flipped).toEqual(['anime-dice', 'call-of-duty', 'fc25', 'fortnite', 'gta-v', 'r6-siege', 'valorant'])
  })

  it('Robux keeps "never": delivery is a game pass', () => {
    const faq = applyGuideToFaq(ADMIN_FAQ, getCurrencyGuide('roblox'))
    expect(faq.find((f) => /password/i.test(f.q))?.a).toBe(ADMIN_FAQ[1].a)
  })
})

describe('six questions at most', () => {
  it("Roblox shows its picked six, in the guide's order", () => {
    const admin = [
      { q: 'How fast is delivery?', a: 'a' },
      { q: 'Is buying Robux safe?', a: 'b' },
      { q: 'Do I need to share my password?', a: 'c' },
      { q: 'What payment methods do you accept?', a: 'd' },
      { q: "What's your refund policy?", a: 'e' },
    ]
    const faq = applyGuideToFaq(admin, getCurrencyGuide('roblox'))
    expect(faq.map((f) => f.q)).toEqual([
      'Is buying Robux safe?',
      'How fast is delivery?',
      'Why is my Robux pending?',
      "How many Robux do I get after Roblox's 30% fee?",
      'Do I need to share my password?',
      'Is there a Robux generator?',
    ])
  })
  it('a guide without a pick is capped at six', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ q: `Q${i}?`, a: 'a' }))
    expect(applyGuideToFaq(many, getCurrencyGuide('fortnite'))).toHaveLength(6)
  })
})

describe('faq_extra merge', () => {
  it('appends the guide questions after the admin list, once', () => {
    const guide = getCurrencyGuide('fortnite')!
    const faq = applyGuideToFaq(ADMIN_FAQ, guide)
    expect(faq.slice(0, 2).map((f) => f.q)).toEqual(ADMIN_FAQ.map((f) => f.q))
    const support = guide.support_topic ? [{ q: guide.support_topic.heading, a: guide.support_topic.paragraphs.slice(0, 2).join(' ') }] : []
    expect(faq.slice(2)).toEqual([...guide.faq_extra, ...support])
  })

  it('skips a guide question the admin list already asks (same words, any case or punctuation)', () => {
    const guide = getCurrencyGuide('fortnite')!
    const dup = { q: guide.faq_extra[0].q.toUpperCase().replace('?', ''), a: 'Admin copy.' }
    const faq = applyGuideToFaq([dup], guide)
    expect(faq.filter((f) => f.q.toLowerCase().startsWith(guide.faq_extra[0].q.toLowerCase().slice(0, 10)))).toHaveLength(1)
    expect(faq).toHaveLength(guide.faq_extra.length + (guide.support_topic ? 1 : 0))
  })

  it("adds the game's support question once (Roblox lists its own pending answer)", () => {
    const roblox = getCurrencyGuide('roblox')!
    const faq = applyGuideToFaq([], roblox)
    expect(faq.filter((f) => /pending/i.test(f.q))).toHaveLength(1)
  })
})
