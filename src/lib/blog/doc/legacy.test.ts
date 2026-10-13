import { describe, expect, it } from 'vitest'
import { legacyToDoc, parseInline } from './legacy'

const p = (...content: unknown[]) => ({ type: 'paragraph', content })
const t = (text: string, marks?: unknown[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text })

describe('parseInline', () => {
  it('links, bold, italic', () => {
    expect(parseInline('See **Godly** and *chroma* at [values](/murder-mystery-2/values).')).toEqual([
      t('See '),
      t('Godly', [{ type: 'bold' }]),
      t(' and '),
      t('chroma', [{ type: 'italic' }]),
      t(' at '),
      t('values', [{ type: 'link', attrs: { href: '/murder-mystery-2/values' } }]),
      t('.'),
    ])
  })
  it('snake_case words and URLs are not italicised', () => {
    expect(parseInline('use mega_neon_fly_ride as the key')).toEqual([t('use mega_neon_fly_ride as the key')])
  })
})

describe('legacyToDoc', () => {
  it('headings, paragraph, rule, quote', () => {
    const doc = legacyToDoc(['## Why It Moves', 'Plain text.', '---', '> Quoted', '### Detail'])
    expect(doc.content).toEqual([
      { type: 'heading', attrs: { level: 2 }, content: [t('Why It Moves')] },
      p(t('Plain text.')),
      { type: 'horizontalRule' },
      { type: 'blockquote', content: [p(t('Quoted'))] },
      { type: 'heading', attrs: { level: 3 }, content: [t('Detail')] },
    ])
  })
  it('lists group across blocks; numbered lists keep counting after an image', () => {
    const doc = legacyToDoc(['1. Go to Sell\n2. Pick the game', '![wide](https://x/a.png)', '3. Publish', '- a\n- b'])
    expect(doc.content[0]).toEqual({ type: 'orderedList', attrs: { start: 1 }, content: [
      { type: 'listItem', content: [p(t('Go to Sell'))] },
      { type: 'listItem', content: [p(t('Pick the game'))] },
    ] })
    expect(doc.content[1]).toMatchObject({ type: 'figure', attrs: { src: 'https://x/a.png', layout: 'wide', alt: '', caption: '' } })
    expect(doc.content[2]).toMatchObject({ type: 'orderedList', attrs: { start: 3 } })
    expect(doc.content[3]).toMatchObject({ type: 'bulletList' })
  })
  it('image words: layout words are dropped, the rest is the caption and alt', () => {
    const doc = legacyToDoc(['![center The Sell page](https://x/b.png)'])
    expect(doc.content[0]).toMatchObject({ type: 'figure', attrs: { layout: 'column', caption: 'The Sell page', alt: 'The Sell page' } })
  })
  it('callouts and steps', () => {
    const doc = legacyToDoc([':::tip\nCheck the **rarity** first.\n:::', ':::steps\nOpen the box\nPick a knife\n:::'])
    expect(doc.content[0]).toEqual({ type: 'callout', attrs: { tone: 'tip' }, content: [p(t('Check the '), t('rarity', [{ type: 'bold' }]), t(' first.'))] })
    expect(doc.content[1]).toMatchObject({ type: 'orderedList', attrs: { start: 1 } })
  })
  it('a table: header row + body rows, separator skipped', () => {
    const doc = legacyToDoc(['| Item | Value |\n|---|---|\n| Harvester | $40 |'])
    expect(doc.content[0]).toEqual({ type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [p(t('Item'))] },
        { type: 'tableHeader', content: [p(t('Value'))] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [p(t('Harvester'))] },
        { type: 'tableCell', content: [p(t('$40'))] },
      ] },
    ] })
  })
  it('each line is its own paragraph (as the old renderer drew them)', () => {
    expect(legacyToDoc(['First para.', 'Second para.\nThird line.']).content).toEqual([p(t('First para.')), p(t('Second para.')), p(t('Third line.'))])
  })
  it('an empty body is one empty paragraph', () => {
    expect(legacyToDoc([]).content).toEqual([{ type: 'paragraph' }])
  })
})
