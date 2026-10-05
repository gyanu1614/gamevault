import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HELP_FAQ,
  HELP_TOPICS,
  REFUNDS_ANCHORS,
  normalizeHelpText,
  searchHelp,
  tokenizeHelpQuery,
  type HelpFaq,
  type HelpTopic,
} from './help-content'
import { getLegalDoc } from '@/lib/legal/documents'
import { buildLegalToc } from '@/components/legal/toc'

const ids = (r: ReturnType<typeof searchHelp>) => r.map((x) => (x.kind === 'faq' ? x.faq.id : `topic:${x.topic.id}`))

describe('help search — query handling', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalizeHelpText('  Refund’s & CHARGEBACKS!! ')).toBe('refunds chargebacks')
    expect(normalizeHelpText('Café')).toBe('cafe')
  })

  it('drops filler words but keeps a query made only of them', () => {
    expect(tokenizeHelpQuery('How do I get my refund?')).toEqual(['refund'])
    expect(tokenizeHelpQuery('how')).toEqual(['how'])
  })

  it('returns nothing for an empty or blank query', () => {
    expect(searchHelp('')).toEqual([])
    expect(searchHelp('   ')).toEqual([])
  })
})

describe('help search — matching and ranking', () => {
  const faqs: HelpFaq[] = [
    { id: 'a', topic: 'payments', q: 'How are refunds paid?', a: 'As store credit.' },
    { id: 'b', topic: 'orders', q: 'Late order?', a: 'You may get a refund.', keywords: ['delivery'] },
    { id: 'c', topic: 'account', q: 'Change password', a: 'In settings.' },
  ]
  const topics: HelpTopic[] = [
    { id: 'payments', title: 'Payments & Refunds', summary: 'Fees.', links: [], keywords: ['card'] },
  ]

  it('matches word prefixes, so partial typing finds results', () => {
    expect(ids(searchHelp('refu', { faqs, topics }))).toEqual(['a', 'topic:payments', 'b'])
  })

  it('ranks question/title hits above answer-only hits', () => {
    const r = searchHelp('refund', { faqs, topics })
    expect(ids(r)[0]).toBe('a')
    expect(ids(r).at(-1)).toBe('b') // only in its answer
  })

  it('requires every meaningful word to match', () => {
    expect(ids(searchHelp('late delivery', { faqs, topics }))).toEqual(['b'])
    expect(searchHelp('late password', { faqs, topics })).toEqual([])
  })

  it('does not match inside words', () => {
    // "fund" is inside "refund" but is not a word prefix.
    expect(searchHelp('fund', { faqs, topics })).toEqual([])
  })

  it('honours the result limit', () => {
    expect(searchHelp('refund', { faqs, topics, limit: 1 })).toHaveLength(1)
  })

  it('finds the real content for common questions', () => {
    expect(ids(searchHelp('chargeback'))).toContain('chargeback')
    expect(ids(searchHelp('my item never arrived'))[0]).toBe('late-order')
    expect(ids(searchHelp('how do I sell'))).toContain('topic:selling')
    expect(ids(searchHelp('2fa'))).toContain('stay-safe')
  })
})

describe('help content integrity', () => {
  it('has unique FAQ ids and every FAQ points at a real topic', () => {
    const faqIds = HELP_FAQ.map((f) => f.id)
    expect(new Set(faqIds).size).toBe(faqIds.length)
    const topicIds = new Set(HELP_TOPICS.map((t) => t.id))
    for (const f of HELP_FAQ) expect(topicIds.has(f.topic), f.id).toBe(true)
  })

  it('deep links into the Refund & Dispute Policy resolve to real section anchors', () => {
    const refunds = getLegalDoc('refunds')!
    const anchors = new Set(buildLegalToc(refunds.sections).map((e) => e.id))
    for (const href of Object.values(REFUNDS_ANCHORS)) {
      expect(anchors.has(href.split('#')[1]), href).toBe(true)
    }
  })

  it('links only to routes that exist', () => {
    const app = join(process.cwd(), 'src/app')
    const routeExists = (path: string) =>
      [
        join(app, path, 'page.tsx'),
        join(app, '(legal)', path, 'page.tsx'),
        join(app, '(marketing)', path, 'page.tsx'),
      ].some(existsSync)
    for (const t of HELP_TOPICS) {
      for (const l of t.links) expect(routeExists(l.href.split('#')[0]), l.href).toBe(true)
    }
  })

  it('never uses custody/escrow wording or "buyer protection"', () => {
    const text = [...HELP_FAQ.flatMap((f) => [f.q, f.a]), ...HELP_TOPICS.flatMap((t) => [t.title, t.summary])]
      .join(' ')
      .toLowerCase()
    expect(text).not.toMatch(/escrow|hold(s|ing)? (the |your )?(money|funds)|buyer protection/)
  })
})
