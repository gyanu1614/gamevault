import { describe, expect, it } from 'vitest'
import { collectHeadings, collectItemRefs, docReadMinutes, docWordCount } from './outline'

const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

describe('collectHeadings', () => {
  it('ids are slugs, unique, in document order (incl. inside callouts)', () => {
    const doc = { type: 'doc' as const, content: [h(2, 'How To Sell'), h(3, 'Step One'), { type: 'callout', content: [h(2, 'How To Sell')] }, h(2, '¿Qué?')] }
    expect(collectHeadings(doc)).toEqual([
      { id: 'how-to-sell', text: 'How To Sell', level: 2 },
      { id: 'step-one', text: 'Step One', level: 3 },
      { id: 'how-to-sell-2', text: 'How To Sell', level: 2 },
      { id: 'que', text: '¿Qué?', level: 2 },
    ])
  })
  it('a heading with no latin letters still gets an id', () => {
    expect(collectHeadings({ type: 'doc', content: [h(2, '★★★')] })[0].id).toBe('section-1')
  })
})

describe('word count and read time', () => {
  it('counts text everywhere, ~220 words a minute, at least 1', () => {
    const doc = { type: 'doc' as const, content: [para('one two three'), { type: 'bulletList', content: [{ type: 'listItem', content: [para('four five')] }] }] }
    expect(docWordCount(doc)).toBe(5)
    expect(docReadMinutes(doc)).toBe(1)
    const long = { type: 'doc' as const, content: [para(Array.from({ length: 1100 }, () => 'w').join(' '))] }
    expect(docReadMinutes(long)).toBe(5)
  })
})

describe('collectItemRefs', () => {
  it('every item card, de-duplicated', () => {
    const card = (g: string, s: string) => ({ type: 'itemCard', attrs: { gameSlug: g, itemSlug: s, name: s, imageUrl: '' } })
    const doc = { type: 'doc' as const, content: [card('murder-mystery-2', 'harvester'), para('x'), card('murder-mystery-2', 'harvester'), card('adopt-me', 'bat-dragon')] }
    expect(collectItemRefs(doc)).toEqual([
      { gameSlug: 'murder-mystery-2', itemSlug: 'harvester', name: 'harvester', imageUrl: '' },
      { gameSlug: 'adopt-me', itemSlug: 'bat-dragon', name: 'bat-dragon', imageUrl: '' },
    ])
  })
})

describe('collectTableItemNames (pictures in tables, Blog v2)', () => {
  const cell = (type: string, text: string, extra: any[] = []) => ({ type, content: [{ type: 'paragraph', content: [...extra, { type: 'text', text }] }] })
  const table = (rows: any[][]) => ({ type: 'table', content: rows.map((r) => ({ type: 'tableRow', content: r })) })
  it('the first column of every body row, not the header, not cells that already have a picture', async () => {
    const { collectTableItemNames, itemKey } = await import('./outline')
    const doc: any = { type: 'doc', content: [table([
      [cell('tableHeader', 'Pet'), cell('tableHeader', 'Price')],
      [cell('tableCell', 'Bat Dragon'), cell('tableCell', '$500')],
      [cell('tableCell', 'Shadow  Dragon '), cell('tableCell', '$290')],
      [cell('tableCell', 'Frost Dragon', [{ type: 'cellImage', attrs: { src: 'x.webp', alt: '' } }]), cell('tableCell', '$150')],
    ])] }
    expect(collectTableItemNames(doc)).toEqual(['Bat Dragon', 'Shadow Dragon'])
    expect(itemKey(' Bat  DRAGON ')).toBe('bat dragon')
  })
})
