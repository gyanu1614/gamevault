/**
 * Drop the blocks a writer left unfilled before the article is drawn: an
 * outline's blank lines, an empty "1." list, a tip box or codes table with
 * nothing in it, an empty table row. The stored post keeps them (the writer may still fill them);
 * readers never see empty space.
 */
import type { BlogDoc, DocNode } from '@/lib/blog/doc/types'

const hasText = (n: DocNode): boolean =>
  n.type === 'text' ? !!n.text?.trim() : (n.content ?? []).some(hasText)

function keep(n: DocNode): DocNode | null {
  switch (n.type) {
    case 'paragraph':
      return hasText(n) ? n : null
    // An item must start with its paragraph (schema): keep it whole or drop it whole.
    case 'listItem':
      return hasText(n) ? n : null
    case 'callout':
    case 'blockquote':
    case 'bulletList':
    case 'orderedList': {
      const content = (n.content ?? []).map(keep).filter((c): c is DocNode => c !== null)
      return content.length ? { ...n, content } : null
    }
    // The header row always stays; a body row with nothing in any cell goes.
    case 'table': {
      const rows = n.content ?? []
      const content = rows.filter((r, i) => i === 0 || hasText(r) || (r.content ?? []).some((c) => (c.content ?? []).some((b) => b.type !== 'paragraph')))
      return { ...n, content }
    }
    case 'codes': {
      const rows = (n.attrs?.rows as Array<{ code?: string }> | undefined) ?? []
      return rows.some((r) => r.code?.trim()) ? n : null
    }
    default:
      return n
  }
}

export function pruneEmpty(doc: BlogDoc): BlogDoc {
  return { ...doc, content: (doc.content ?? []).map(keep).filter((c): c is DocNode => c !== null) }
}
