import { describe, expect, it } from 'vitest'
import { postChecklist, slugify } from './checklist'

const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const fig = (alt: string) => ({ type: 'figure', attrs: { src: 'x.webp', alt, caption: '' } })
const linkTo = (href: string) => ({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }] })
const good = {
  title: 'How To Get A Chroma Luger In MM2',
  slug: 'how-to-get-chroma-luger',
  gameSlug: 'murder-mystery-2',
  excerpt: 'The fastest ways to get a Chroma Luger, and what it sells for.',
  seoDescription: '',
  hasCover: true,
  doc: { type: 'doc' as const, content: [h2('What It Is'), h2('How To Get It'), fig('Chroma Luger in hand'), linkTo('/murder-mystery-2/values/chroma-luger')] },
}

describe('postChecklist', () => {
  it('a complete post passes every check', () => {
    const r = postChecklist(good)
    expect(r.blocking).toEqual([])
    expect(r.items.every((i) => i.ok)).toBe(true)
  })
  it('missing title, slug or game blocks publishing', () => {
    const r = postChecklist({ ...good, title: ' ', slug: '', gameSlug: null })
    expect(r.blocking.map((b) => b.id).sort()).toEqual(['game', 'slug', 'title'])
  })
  it('an image without alt text blocks publishing', () => {
    const r = postChecklist({ ...good, doc: { ...good.doc, content: [...good.doc.content, fig('')] } })
    expect(r.blocking.map((b) => b.id)).toEqual(['alt'])
  })
  it('empty image slots are a warning, not a block', () => {
    const slot = { type: 'figure', attrs: { src: '', alt: 'lobby', caption: '' } }
    const r = postChecklist({ ...good, doc: { ...good.doc, content: [...good.doc.content, slot, slot] } })
    expect(r.blocking).toEqual([])
    expect(r.items.find((i) => i.id === 'slots')).toMatchObject({ ok: false, label: 'Add pictures to 2 empty image slots' })
  })
  it('soft checks warn but never block', () => {
    const r = postChecklist({ ...good, title: 'x'.repeat(70), hasCover: false, doc: { type: 'doc', content: [{ type: 'paragraph' }] } })
    expect(r.blocking).toEqual([])
    expect(r.items.filter((i) => !i.ok).map((i) => i.id).sort()).toEqual(['cover', 'links', 'sections', 'titleLength'])
  })
})

describe('slugify', () => {
  it('lowercase words joined by dashes, no symbols, ≤ 80 chars', () => {
    expect(slugify('How To Get A Chroma Luger (2026)!')).toBe('how-to-get-a-chroma-luger-2026')
    expect(slugify('  Mega Neon — Explained  ')).toBe('mega-neon-explained')
    expect(slugify('x'.repeat(100)).length).toBe(80)
  })
})
