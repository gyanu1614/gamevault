import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
;(globalThis as any).React = React
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: any) => React.createElement('a', { href, ...rest }, children),
}))
import { renderToStaticMarkup } from 'react-dom/server'
import { BlogDocView } from './BlogDocView'
import { legacyToDoc } from '@/lib/blog/doc/legacy'

const t = (text: string, marks?: any[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text })
const img = { src: 'https://cdn/x/1920.webp', width: 1920, height: 1080, blur: 'data:image/webp;base64,AA', sources: { avif: [{ w: 480, url: 'https://cdn/x/480.avif' }, { w: 1920, url: 'https://cdn/x/1920.avif' }], webp: [{ w: 480, url: 'https://cdn/x/480.webp' }, { w: 1920, url: 'https://cdn/x/1920.webp' }] } }

const doc: any = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [t('How To Sell')] },
    { type: 'paragraph', content: [t('Go to '), t('values', [{ type: 'link', attrs: { href: 'https://dropmarket.gg/murder-mystery-2/values' } }]), t(' or '), t('Roblox', [{ type: 'link', attrs: { href: 'https://www.roblox.com' } }])] },
    { type: 'figure', attrs: { ...img, alt: 'The sell page', caption: 'The sell page', layout: 'wide' } },
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [t('Publish')] }] }] },
    { type: 'callout', attrs: { tone: 'warning' }, content: [{ type: 'paragraph', content: [t('Never trade first.')] }] },
    { type: 'table', content: [
      { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [t('Item')] }] }] },
      { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [t('Harvester')] }] }] },
    ] },
    { type: 'faq', attrs: { items: [{ q: 'Is it safe?', a: 'Yes.' }] } },
    { type: 'codes', attrs: { rows: [{ code: 'FREEKNIFE', reward: 'A knife', isNew: true }, { code: 'OLD', reward: '', expired: true }], checkedAt: '2026-10-12' } },
    { type: 'itemCard', attrs: { gameSlug: 'murder-mystery-2', itemSlug: 'harvester', name: 'Harvester', imageUrl: '/h.png' } },
    { type: 'heading', attrs: { level: 2 }, content: [t('How To Sell')] },
  ],
}

describe('BlogDocView', () => {
  const html = renderToStaticMarkup(React.createElement(BlogDocView, { doc, items: new Map([['murder-mystery-2/harvester', { name: 'Harvester', lines: ['4 offers'], buyLabel: 'Buy From $40', href: '/murder-mystery-2/buy-items/item/harvester', image: null } as any]]) }))

  it('images: AVIF + WebP sources, real size, wide layout, caption', () => {
    expect(html).toContain('<source type="image/avif" srcSet="https://cdn/x/480.avif 480w, https://cdn/x/1920.avif 1920w"')
    expect(html).toMatch(/<img[^>]+width="1920"[^>]+height="1080"/)
    expect(html).toContain('class="mt-7 blog-wide"')
    expect(html).toContain('max-height:640px') // a Wide photo's height cap (picture-size.ts)
    expect(html).toContain('<figcaption')
  })
  it('own-domain links are internal; other sites open in a new tab', () => {
    expect(html).toContain('href="/murder-mystery-2/values"')
    expect(html).toMatch(/href="https:\/\/www\.roblox\.com\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer nofollow"/)
  })
  it('numbered lists keep their start; headings get unique ids in order', () => {
    expect(html).toContain('<ol start="3"')
    expect(html).toContain('id="how-to-sell"')
    expect(html).toContain('id="how-to-sell-2"')
  })
  it('callout, table scroll box, FAQ details, codes with copy + expired list, item card with live buy label', () => {
    expect(html).toContain('Warning')
    expect(html).toContain('class="blog-table relative"') // framed, scrollable table (blog-prose.css)
    expect(html).toContain('Is it safe?') // FAQ: the value pages' accordion, answer in the HTML
    expect(html).toContain('>Yes.<')
    expect(html).toContain('FREEKNIFE')
    expect(html).toContain('Expired Codes (1)')
    expect(html).toContain('Last checked Oct 12, 2026')
    expect(html).toContain('Buy From $40')
    expect(html).toContain('href="/murder-mystery-2/values/harvester"')
  })
  it('a legacy post renders through the same renderer', () => {
    const legacy = renderToStaticMarkup(React.createElement(BlogDocView, { doc: legacyToDoc(['## Intro', 'Hello **world**', '![wide](https://x/a.png)']) }))
    expect(legacy).toContain('id="intro"')
    expect(legacy).toContain('<strong')
    expect(legacy).toContain('blog-wide')
  })
})

describe('BlogDocView: unfilled outline blocks stay out of the article', () => {
  const draft: any = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [t('Step by Step')] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [t('   ')] },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [t('Kept')] }] }, { type: 'listItem', content: [{ type: 'paragraph' }] }] },
      { type: 'callout', attrs: { tone: 'tip' }, content: [{ type: 'paragraph' }] },
      { type: 'codes', attrs: { rows: [{ code: '', reward: '', isNew: true }], checkedAt: '2026-10-12' } },
      { type: 'paragraph', content: [t('Real text')] },
    ],
  }
  const html = renderToStaticMarkup(React.createElement(BlogDocView, { doc: draft }))

  it('drops empty paragraphs, empty list items and lists, empty tip boxes and empty codes tables', () => {
    expect(html.match(/<p[ >]/g)?.length).toBe(2) // "Kept" (inside its list item) + "Real text"
    expect(html).not.toContain('<ol')
    expect(html.match(/<li[ >]/g)?.length).toBe(1)
    expect(html).not.toContain('Tip')
    expect(html).not.toContain('Last checked')
    expect(html).toContain('Real text')
  })
})

describe('BlogDocView: game tool links', () => {
  const linkDoc: any = { type: 'doc', content: [{ type: 'paragraph', content: [
    t('values', [{ type: 'link', attrs: { href: '/values' } }]), t(' '),
    t('item', [{ type: 'link', attrs: { href: '/values/bat-dragon' } }]), t(' '),
    t('calc', [{ type: 'link', attrs: { href: '/calculator' } }]), t(' '),
    t('sell', [{ type: 'link', attrs: { href: '/sell' } }]),
  ] }] }
  it('/values and /calculator point at the post’s own game; site pages stay as they are', () => {
    const html = renderToStaticMarkup(React.createElement(BlogDocView, { doc: linkDoc, gameSlug: 'adopt-me' }))
    expect(html).toContain('href="/adopt-me/values"')
    expect(html).toContain('href="/adopt-me/values/bat-dragon"')
    expect(html).toContain('href="/adopt-me/calculator"')
    expect(html).toContain('href="/sell"')
  })
})

describe('BlogDocView: empty table rows', () => {
  const cell = (type: string, text?: string) => ({ type, content: [text ? { type: 'paragraph', content: [t(text)] } : { type: 'paragraph' }] })
  const tableDoc: any = { type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [cell('tableHeader', 'Item'), cell('tableHeader', 'Why')] },
    { type: 'tableRow', content: [cell('tableCell', 'Pet'), cell('tableCell', 'Sells')] },
    { type: 'tableRow', content: [cell('tableCell'), cell('tableCell')] },
  ] }] }
  it('a row whose cells are all empty is left out', () => {
    const html = renderToStaticMarkup(React.createElement(BlogDocView, { doc: tableDoc }))
    expect(html.match(/<tr[ >]/g)?.length).toBe(2)
  })
})

describe('BlogDocView: image description falls back to the caption', () => {
  it('an empty description uses the caption as the alt text', () => {
    const d: any = { type: 'doc', content: [{ type: 'figure', attrs: { ...img, alt: '', caption: 'The lobby at night', layout: 'column' } }] }
    expect(renderToStaticMarkup(React.createElement(BlogDocView, { doc: d }))).toContain('alt="The lobby at night"')
  })
})

describe('BlogDocView: picture size system', () => {
  it('a transparent cut-out has no rounded box or placeholder; a small picture gets the standard height', () => {
    const cut: any = { type: 'doc', content: [{ type: 'figure', attrs: { ...img, width: 1365, height: 768, alpha: true, alt: 'Lures', caption: '', layout: 'column' } }] }
    const h1 = renderToStaticMarkup(React.createElement(BlogDocView, { doc: cut }))
    expect(h1).not.toContain('rounded-[20px]')
    expect(h1).not.toContain('background-image')
    const small: any = { type: 'doc', content: [{ type: 'figure', attrs: { ...img, width: 232, height: 307, alt: 'Potion', caption: '', layout: 'column' } }] }
    expect(renderToStaticMarkup(React.createElement(BlogDocView, { doc: small }))).toContain('height:240px')
  })
})

