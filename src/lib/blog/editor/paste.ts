/**
 * Pasting a post written elsewhere (2026-10-13). A chat's Copy button hands
 * over Markdown as plain text ("## Heading", "**bold**"), which would paste
 * as literal symbols; these helpers let the editor turn it into real blocks.
 * Posts use two heading sizes, so a pasted title (#) becomes a section
 * heading and anything below ### becomes a small heading. Pure, for tests.
 */
import type { CalloutTone, DocNode } from '@/lib/blog/doc/types'
import { figureFromLine } from '@/lib/blog/doc/legacy'

const MD_SIGNS = [
  /^#{1,6}\s+\S/m, // heading
  /\*\*[^*\n]+\*\*/, // bold
  /\[[^\]\n]+\]\([^)\s]+\)/, // link
  /^\s*[-*+]\s+\S/m, // bullet
  /^\s*\d+[.)]\s+\S/m, // numbered
  /^\|.+\|\s*$/m, // table row
]

export function looksLikeMarkdown(text: string): boolean {
  return MD_SIGNS.some((re) => re.test(text))
}

/** The post format the old editor read: :::tip / :::steps boxes and image slots. */
export function hasPostMarkers(text: string): boolean {
  return /^\s*:{2,3}\s*(tip|warning|note|takeaways|steps)\b/im.test(text) || /!\[[^\]]*\]\([^)\s]+\)/.test(text)
}

export function fitHeadings(markdown: string): string {
  return markdown.replace(/^#{1,6}(?=\s)/gm, (h) => (h.length <= 2 ? '##' : '###'))
}

export function fitHtmlHeadings(html: string): string {
  return html.replace(/<(\/?)h([1-6])\b/gi, (_, slash: string, level: string) => {
    const n = Number(level)
    return `<${slash}h${n <= 2 ? 2 : 3}`
  })
}

/** Copied HTML that holds our markers or picture placeholders (and so needs wrapDirectives). */
export function htmlHasPostMarkers(html: string): boolean {
  return /:{2,3}\s*(tip|warning|note|takeaways|steps)\b/i.test(html) || /<img\b/i.test(html) || /!\[[^\]]*\]\(/.test(html)
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ?? ''
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** <img> in copied HTML → our figure block; a placeholder address becomes an empty slot. */
export function imgToFigureHtml(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, 'src')
    const real = /^https?:\/\//i.test(src)
    const alt = attr(tag, 'alt').replace(/^\s*(image|photo|screenshot)\s*:\s*/i, '').trim()
    return `<figure data-block="figure" src="${real ? esc(src) : ''}" alt="${esc(alt)}" layout="column"></figure>`
  })
}

const text = (n: DocNode): string => (n.type === 'text' ? n.text ?? '' : (n.content ?? []).map(text).join(''))
const OPEN = /^:{2,3}\s*(tip|warning|note|takeaways|steps)\b\s*(.*)$/i
const CLOSE = /^:{2,3}$/

/**
 * Blocks from a formatted copy → our boxes: a paragraph "::tip" (or ":::tip")
 * up to a paragraph "::" wraps what is between into a tip box; "steps"
 * becomes a numbered list; a "![IMAGE: …](…)" line becomes an image slot.
 */
export function wrapDirectives(nodes: DocNode[]): DocNode[] {
  const out: DocNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const line = n.type === 'paragraph' ? text(n).trim() : ''
    // Blank lines a copy leaves around pictures and boxes carry nothing.
    if (n.type === 'paragraph' && !line) continue
    const fig = line ? figureFromLine(line) : null
    if (fig) { out.push(fig); continue }
    const open = line.match(OPEN)
    if (!open) { out.push(n); continue }
    const inner: DocNode[] = []
    if (open[2].trim()) inner.push({ type: 'paragraph', content: [{ type: 'text', text: open[2].trim() }] })
    i += 1
    while (i < nodes.length && !(nodes[i].type === 'paragraph' && CLOSE.test(text(nodes[i]).trim()))) inner.push(nodes[i]), (i += 1)
    const kind = open[1].toLowerCase()
    if (kind === 'steps') {
      const items = inner.flatMap((b) =>
        b.type === 'bulletList' || b.type === 'orderedList'
          ? b.content ?? []
          : b.type === 'paragraph' && text(b).trim() ? [{ type: 'listItem', content: [b] }] : [],
      )
      if (items.length) out.push({ type: 'orderedList', attrs: { start: 1 }, content: items })
    } else {
      out.push({ type: 'callout', attrs: { tone: kind as CalloutTone }, content: inner.length ? wrapDirectives(inner) : [{ type: 'paragraph' }] })
    }
  }
  return out
}
