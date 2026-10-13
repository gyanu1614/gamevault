/**
 * FAQ sections written as text (2026-10-13): posts from a chat say
 * "## FAQ" and then "### question" + answer lines. That section becomes ONE
 * FAQ block — the accordion the value pages use — under the same heading,
 * so the post reads like the rest of the site and its Q&As can be sent to
 * search as FAQPage data. Pure, so paste, old posts and tests share it.
 */
import type { BlogDoc, DocNode } from './types'

const ANSWER = new Set(['paragraph', 'bulletList', 'orderedList', 'blockquote'])
const FAQ_TITLE = /\b(faqs?|frequently asked questions)\b/i
const text = (n: DocNode): string => (n.type === 'text' ? n.text ?? '' : (n.content ?? []).map(text).join(''))
const isHeading = (n: DocNode, level?: number) => n.type === 'heading' && (level === undefined || Number(n.attrs?.level) === level)

export function foldFaqSections(nodes: DocNode[]): DocNode[] {
  const out: DocNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    out.push(n)
    if (!isHeading(n, 2) || !FAQ_TITLE.test(text(n))) continue
    const items: Array<{ q: string; a: string }> = []
    let j = i + 1
    while (j < nodes.length && isHeading(nodes[j], 3)) {
      const q = text(nodes[j]).trim()
      const answer: string[] = []
      j += 1
      // An answer is text (paragraphs, lists, a quote); a divider, image or table ends the FAQ.
      while (j < nodes.length && ANSWER.has(nodes[j].type)) {
        const line = text(nodes[j]).trim()
        if (line) answer.push(line)
        j += 1
      }
      if (q) items.push({ q, a: answer.join('\n') })
    }
    if (items.length === 0) continue
    out.push({ type: 'faq', attrs: { items } })
    i = j - 1
  }
  return out
}

/** Every visible Q&A in the post's FAQ blocks (questions with text only). */
export function faqItems(doc: BlogDoc): Array<{ q: string; a: string }> {
  const items: Array<{ q: string; a: string }> = []
  const walk = (n: DocNode) => {
    if (n.type === 'faq') for (const it of (n.attrs?.items as Array<{ q?: string; a?: string }> | undefined) ?? []) if (it.q?.trim()) items.push({ q: it.q.trim(), a: (it.a ?? '').trim() })
    for (const c of n.content ?? []) walk(c)
  }
  walk(doc)
  return items
}
