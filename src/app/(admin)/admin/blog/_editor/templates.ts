/**
 * Starting outlines for a new post, by type (2026-10-12). Headings only, plus
 * the block a type always needs (codes table, FAQ) — the writer fills them in.
 */
import type { BlogDoc, DocNode } from '@/lib/blog/doc/types'

const h2 = (text: string): DocNode => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const p = (): DocNode => ({ type: 'paragraph' })

export const TEMPLATES: Record<'blank' | 'guide' | 'codes' | 'tier' | 'news', { label: string; postType: 'guide' | 'value' | 'seller'; doc: BlogDoc }> = {
  blank: { label: 'Blank', postType: 'guide', doc: { type: 'doc', content: [p()] } },
  guide: {
    label: 'Guide',
    postType: 'guide',
    doc: { type: 'doc', content: [p(), h2('The Short Answer'), p(), h2('Step by Step'), { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p()] }] }, h2('Mistakes to Avoid'), p(), h2('FAQ'), { type: 'faq', attrs: { items: [{ q: '', a: '' }] } }] },
  },
  codes: {
    label: 'Codes',
    postType: 'guide',
    doc: { type: 'doc', content: [p(), h2('Working Codes'), { type: 'codes', attrs: { rows: [{ code: '', reward: '', isNew: true }], checkedAt: new Date().toISOString().slice(0, 10) } }, h2('How to Redeem Codes'), { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p()] }] }, h2('FAQ'), { type: 'faq', attrs: { items: [{ q: '', a: '' }] } }] },
  },
  tier: {
    label: 'Tier List',
    postType: 'value',
    doc: { type: 'doc', content: [p(), h2('How We Ranked Them'), p(), h2('S Tier'), p(), h2('A Tier'), p(), h2('B Tier'), p()] },
  },
  news: {
    label: 'News / Update',
    postType: 'guide',
    doc: { type: 'doc', content: [p(), h2('What Changed'), p(), h2('What It Means for Prices'), p()] },
  },
}
