import { describe, expect, it } from 'vitest'
import { faqItems, foldFaqSections } from './faq'

const t = (text: string) => ({ type: 'text', text })
const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [t(text)] })
const p = (text: string) => ({ type: 'paragraph', content: [t(text)] })

describe('foldFaqSections', () => {
  it('## FAQ + ### questions with answers → the heading, then one FAQ block', () => {
    const out = foldFaqSections([
      h(2, 'FAQ'),
      h(3, 'Can you sell pets?'), p('Yes.'), p('Here is how.'),
      h(3, 'What is the most expensive pet?'), p('The Bat Dragon.'),
      h(2, 'Start Selling'), p('After'),
    ])
    expect(out).toEqual([
      h(2, 'FAQ'),
      { type: 'faq', attrs: { items: [{ q: 'Can you sell pets?', a: 'Yes.\nHere is how.' }, { q: 'What is the most expensive pet?', a: 'The Bat Dragon.' }] } },
      h(2, 'Start Selling'), p('After'),
    ])
  })
  it('also "Frequently Asked Questions" and "FAQs"', () => {
    expect(foldFaqSections([h(2, 'Frequently Asked Questions'), h(3, 'Q?'), p('A.')])[1].type).toBe('faq')
    expect(foldFaqSections([h(2, 'MM2 FAQs'), h(3, 'Q?'), p('A.')])[1].type).toBe('faq')
  })
  it('a divider after the last answer stays a divider', () => {
    const out = foldFaqSections([h(2, 'FAQ'), h(3, 'Q?'), p('A.'), { type: 'horizontalRule' }, h(2, 'Next')])
    expect(out.map((n) => n.type)).toEqual(['heading', 'faq', 'horizontalRule', 'heading'])
  })
  it('leaves other sections and an FAQ heading with no questions alone', () => {
    const plain = [h(2, 'Tips'), h(3, 'One'), p('x')]
    expect(foldFaqSections(plain)).toEqual(plain)
    expect(foldFaqSections([h(2, 'FAQ'), p('Ask us anything.')])).toEqual([h(2, 'FAQ'), p('Ask us anything.')])
  })
})

describe('faqItems', () => {
  it('collects the visible Q&As of every FAQ block, for FAQPage data', () => {
    const doc = { type: 'doc' as const, content: [{ type: 'faq', attrs: { items: [{ q: 'Q1', a: 'A1' }, { q: ' ', a: 'skip' }] } }, { type: 'faq', attrs: { items: [{ q: 'Q2', a: 'A2' }] } }] }
    expect(faqItems(doc)).toEqual([{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }])
  })
})
