/**
 * Legacy post bodies → the block doc. Old posts were an array of markdown-ish
 * strings (the syntax the old `_articleBody.tsx` parser read); this converts
 * them to the same Tiptap doc new posts store, so ONE renderer draws every
 * post and the editor can open an old post as blocks. Pure, no React.
 *
 *   ## / ###        heading 2 / 3
 *   - / 1.          bullet / numbered list (a numbered list keeps its number
 *                   across an image, so step 3 after a picture reads "3.")
 *   > / ---         quote / divider
 *   ![words](url)   figure; "wide" → wide layout, "center" dropped, the rest
 *                   is the caption and the alt text
 *   :::tip|warning|note|takeaways … :::   callout
 *   :::steps … :::  numbered list
 *   | a | b |       table (first row = header, |---| separator skipped)
 *   inline          [text](url), **bold**, *italic*
 */
import type { BlogDoc, CalloutTone, DocNode } from './types'

type Mark = { type: string; attrs?: Record<string, unknown> }

const INLINE_RE = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g

/** Inline markdown → text nodes with marks. `_x_` is NOT italic (it broke snake_case and URLs). */
export function parseInline(text: string, marks: Mark[] = []): DocNode[] {
  const out: DocNode[] = []
  const push = (s: string, m: Mark[]) => {
    if (!s) return
    out.push(m.length ? { type: 'text', text: s, marks: m } : { type: 'text', text: s })
  }
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0
    push(text.slice(last, at), marks)
    const [full, label, href, bold, italic] = m
    if (label != null && href != null) out.push(...parseInline(label, [...marks, { type: 'link', attrs: { href } }]))
    else if (bold != null) out.push(...parseInline(bold, [...marks, { type: 'bold' }]))
    else if (italic != null) out.push(...parseInline(italic, [...marks, { type: 'italic' }]))
    last = at + full.length
  }
  push(text.slice(last), marks)
  return out
}

const para = (text: string): DocNode => {
  const content = parseInline(text.trim())
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

const ORDERED_RE = /^\s*(\d+)\.\s+/
const BULLET_RE = /^\s*[-*]\s+/
const TABLE_RE = /^\s*\|.*\|\s*$/
const IMAGE_RE = /^!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)$/
const FENCE_RE = /^:::\s*(tip|warning|note|takeaways|steps)\b(.*)$/i

const listItem = (text: string): DocNode => ({ type: 'listItem', content: [para(text)] })

function tableNode(rows: string[]): DocNode {
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const bodyStart = /^[\s|:-]+$/.test(rows[1] ?? '') ? 2 : 1
  const row = (r: string, cellType: string): DocNode => ({
    type: 'tableRow',
    content: cells(r).map((c) => ({ type: cellType, content: [para(c)] })),
  })
  return { type: 'table', content: [row(rows[0], 'tableHeader'), ...rows.slice(bodyStart).map((r) => row(r, 'tableCell'))] }
}

function figureNode(words: string, src: string): DocNode {
  const tokens = words.trim().split(/\s+/).filter(Boolean)
  const wide = tokens.some((w) => w.toLowerCase() === 'wide')
  const caption = tokens.filter((w) => !/^(center|wide)$/i.test(w)).join(' ')
  const text = caption.toLowerCase() === 'image' ? '' : caption
  return {
    type: 'figure',
    attrs: { src, sources: null, width: null, height: null, blur: null, alt: text, caption: text, layout: wide ? 'wide' : 'column' },
  }
}

/** Lines → blocks. Used for the whole body and, recursively, inside callouts. */
function linesToBlocks(lines: string[]): DocNode[] {
  const blocks: DocNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trimEnd()
    const trimmed = line.trim()
    if (!trimmed) { i += 1; continue }

    const fence = trimmed.match(FENCE_RE)
    if (fence) {
      const kind = fence[1].toLowerCase()
      const inner: string[] = []
      const same = fence[2].replace(/:::\s*$/, '').trim()
      if (same) inner.push(same)
      i += 1
      while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i]), (i += 1)
      i += 1
      if (kind === 'steps') {
        const items = inner.map((l) => l.trim()).filter(Boolean).map((l) => l.replace(ORDERED_RE, '').replace(BULLET_RE, ''))
        blocks.push({ type: 'orderedList', attrs: { start: 1 }, content: items.map(listItem) })
      } else {
        const content = linesToBlocks(inner)
        blocks.push({ type: 'callout', attrs: { tone: kind as CalloutTone }, content: content.length ? content : [{ type: 'paragraph' }] })
      }
      continue
    }
    const ordered = line.match(ORDERED_RE)
    if (ordered) {
      const start = Number(ordered[1])
      const items: DocNode[] = []
      while (i < lines.length && ORDERED_RE.test(lines[i])) items.push(listItem(lines[i].replace(ORDERED_RE, ''))), (i += 1)
      blocks.push({ type: 'orderedList', attrs: { start }, content: items })
      continue
    }
    if (BULLET_RE.test(line) && !/^\s*\*\*/.test(line)) {
      const items: DocNode[] = []
      while (i < lines.length && BULLET_RE.test(lines[i]) && !/^\s*\*\*/.test(lines[i])) items.push(listItem(lines[i].replace(BULLET_RE, ''))), (i += 1)
      blocks.push({ type: 'bulletList', content: items })
      continue
    }
    if (TABLE_RE.test(line)) {
      const rows: string[] = []
      while (i < lines.length && TABLE_RE.test(lines[i])) rows.push(lines[i]), (i += 1)
      blocks.push(tableNode(rows))
      continue
    }
    if (trimmed.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i].trim().replace(/^>\s?/, '')), (i += 1)
      blocks.push({ type: 'blockquote', content: [para(quote.join(' '))] })
      continue
    }
    const heading = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2].trim()) })
      i += 1
      continue
    }
    if (/^-{3,}$/.test(trimmed)) { blocks.push({ type: 'horizontalRule' }); i += 1; continue }
    const image = trimmed.match(IMAGE_RE)
    if (image) { blocks.push(figureNode(image[1], image[2])); i += 1; continue }
    // A plain line is one paragraph (the old renderer drew each line as its own <p>).
    blocks.push(para(trimmed.replace(/^#\s+/, '')))
    i += 1
  }
  return blocks
}

export function legacyToDoc(body: readonly string[]): BlogDoc {
  const content = linesToBlocks(body.flatMap((b) => String(b).split('\n')))
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}
