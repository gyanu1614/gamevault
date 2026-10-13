/**
 * The editor's publish checklist (2026-10-12): what a post must have before it
 * can go live (blocking) and what makes it rank and read better (warnings).
 * Pure, so the side panel and tests share it.
 */
import type { BlogDoc, DocNode } from '@/lib/blog/doc/types'

export interface CheckInput {
  title: string
  slug: string
  gameSlug: string | null
  excerpt: string
  seoDescription: string
  hasCover: boolean
  doc: BlogDoc
}

export interface CheckItem {
  id: 'title' | 'slug' | 'game' | 'alt' | 'slots' | 'titleLength' | 'summary' | 'cover' | 'sections' | 'links'
  label: string
  ok: boolean
  blocking: boolean
}

function walk(node: DocNode, visit: (n: DocNode) => void) {
  visit(node)
  for (const c of node.content ?? []) walk(c, visit)
}

// A value, shop or calculator page, with or without the game ("/values" resolves to the post's game).
const MONEY_LINK = /^(?:https?:\/\/(?:www\.)?dropmarket\.gg)?(?:\/[a-z0-9-]+)?\/(?:values|buy-|calculator)/

export function postChecklist(p: CheckInput): { items: CheckItem[]; blocking: CheckItem[] } {
  let h2 = 0
  let missingAlt = 0
  let emptySlots = 0
  let moneyLinks = 0
  walk(p.doc, (n) => {
    if (n.type === 'heading' && Number(n.attrs?.level) === 2) h2 += 1
    if (n.type === 'figure' && n.attrs?.src && !String(n.attrs?.alt ?? '').trim()) missingAlt += 1
    if (n.type === 'figure' && !n.attrs?.src) emptySlots += 1
    if (n.type === 'imagePair') {
      for (const side of [n.attrs?.a, n.attrs?.b] as Array<{ image?: { src?: string }; alt?: string } | null>) {
        if (side?.image?.src && !side.alt?.trim()) missingAlt += 1
      }
    }
    if (n.type === 'itemCard') moneyLinks += 1
    for (const m of n.marks ?? []) if (m.type === 'link' && MONEY_LINK.test(String(m.attrs?.href ?? ''))) moneyLinks += 1
  })
  const title = p.title.trim()
  const description = (p.seoDescription || p.excerpt).trim()
  const items: CheckItem[] = [
    { id: 'title', label: 'A title', ok: title.length > 0, blocking: true },
    { id: 'slug', label: 'A URL slug', ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug), blocking: true },
    { id: 'game', label: 'A game', ok: !!p.gameSlug, blocking: true },
    { id: 'alt', label: missingAlt ? `Alt text on ${missingAlt} image${missingAlt === 1 ? '' : 's'}` : 'Alt text on every image', ok: missingAlt === 0, blocking: true },
    {
      id: 'slots',
      label: emptySlots ? `Add pictures to ${emptySlots} empty image slot${emptySlots === 1 ? '' : 's'}` : 'No empty image slots',
      ok: emptySlots === 0,
      blocking: false,
    },
    { id: 'titleLength', label: `Title fits Google (${title.length}/60)`, ok: title.length > 0 && title.length <= 60, blocking: false },
    { id: 'summary', label: 'A summary for Google (≤ 155)', ok: description.length >= 50 && description.length <= 155, blocking: false },
    { id: 'cover', label: 'A cover image', ok: p.hasCover, blocking: false },
    { id: 'sections', label: `2+ sections (${h2})`, ok: h2 >= 2, blocking: false },
    { id: 'links', label: 'A link to a value or shop page', ok: moneyLinks > 0, blocking: false },
  ]
  return { items, blocking: items.filter((i) => i.blocking && !i.ok) }
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '')
}
