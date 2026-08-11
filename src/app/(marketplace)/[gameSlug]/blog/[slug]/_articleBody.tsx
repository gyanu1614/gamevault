/**
 * Renders a DB post body into the article design.
 *
 * Bodies are stored as `string[]` — one entry per block, split on blank lines —
 * but each block may itself contain MULTIPLE lines (a numbered list, a table, a
 * callout). The parser flattens all blocks into a single line stream and then
 * groups lines into elements, so a pasted markdown doc renders correctly whether
 * or not the author left blank lines between list items.
 *
 * Supported syntax:
 *   "## H"  / "### H"          → h2 (TOC anchor) / h3
 *   "- item"                    → bulleted list (consecutive lines group)
 *   "1. item"                   → numbered list (<ol>, consecutive lines group)
 *   "> quote"                   → pull quote
 *   "---"                       → divider
 *   "![alt](url)" own line      → figure; alt "center"/"wide"/"center wide"
 *                                 sets alignment/width, else alt is the caption
 *   ":::tip … :::" (+ warning/note/takeaways) → callout box
 *   ":::steps … :::"            → numbered step cards
 *   "| a | b |" rows            → table
 *   inline: [text](url) **bold** *italic* _italic_
 *
 * Live blocks (::price::, ::cta::, :::faq, ::card::) are handled by the
 * server-side renderer in page.tsx via `renderLiveBlock`; here they no-op-render
 * as plain text if they slip through (defensive).
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

export interface TocEntry {
  id: string
  label: string
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

/** Flatten blocks → lines. TOC only needs H2s, still one-per-line. */
export function extractToc(body: string[]): TocEntry[] {
  return body
    .flatMap((block) => block.split('\n'))
    .filter((line) => /^##\s+/.test(line) && !/^###\s+/.test(line))
    .map((line) => {
      const label = line.replace(/^##\s+/, '').trim()
      return { id: slugifyHeading(label), label }
    })
}

const ORDERED_RE = /^\s*\d+\.\s+/
const BULLET_RE = /^\s*-\s+/

/**
 * Inline markdown → React nodes. One left-to-right pass:
 *   [text](href) → Link/a · **bold** → strong · *italic* / _italic_ → em
 * Bold matched before italic. Bold/italic content re-runs through renderInline.
 */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [full, linkLabel, href, bold, italicStar, italicUnderscore] = m
    if (linkLabel != null && href != null) {
      parts.push(
        href.startsWith('/') ? (
          <Link key={key++} href={href} className="text-[#8FBF9C] underline-offset-2 hover:underline">
            {linkLabel}
          </Link>
        ) : (
          <a key={key++} href={href} className="text-[#8FBF9C] underline-offset-2 hover:underline" rel="nofollow noopener" target="_blank">
            {linkLabel}
          </a>
        ),
      )
    } else if (bold != null) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#E4EAE2]">
          {renderInline(bold)}
        </strong>,
      )
    } else {
      parts.push(
        <em key={key++} className="italic">
          {renderInline((italicStar ?? italicUnderscore) ?? '')}
        </em>,
      )
    }
    last = m.index + full.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Callout box: tip (green), warning (amber), note (neutral), takeaways. */
function Callout({ kind, lines, keyId }: { kind: string; lines: string[]; keyId: number }) {
  const style =
    kind === 'warning'
      ? { border: '#E0B155', bg: 'rgba(224,177,85,0.08)', label: 'Warning', labelColor: '#E7D6A8' }
      : kind === 'note'
        ? { border: '#4C6473', bg: 'rgba(76,100,115,0.10)', label: 'Note', labelColor: '#AEC4D0' }
        : kind === 'takeaways'
          ? { border: '#4FB477', bg: 'rgba(79,180,119,0.08)', label: 'Key takeaways', labelColor: '#9FD9B2' }
          : { border: '#4FB477', bg: 'rgba(79,180,119,0.08)', label: 'Tip', labelColor: '#9FD9B2' }
  const isList = kind === 'takeaways' || lines.every((l) => BULLET_RE.test(l) || ORDERED_RE.test(l))
  return (
    <div
      key={keyId}
      className="my-7 border-l-2 px-5 py-4"
      style={{ borderColor: style.border, background: style.bg }}
    >
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: style.labelColor }}>
        {style.label}
      </div>
      {isList ? (
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-7 text-[#C6D4C9] sm:text-[15px]">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(BULLET_RE, '').replace(ORDERED_RE, ''))}</li>
          ))}
        </ul>
      ) : (
        lines.map((l, i) => (
          <p key={i} className="text-[14.5px] leading-7 text-[#C6D4C9] sm:text-[15px]">
            {renderInline(l)}
          </p>
        ))
      )}
    </div>
  )
}

/** Numbered step cards (:::steps). Each line is a step. */
function Steps({ lines, keyId }: { lines: string[]; keyId: number }) {
  return (
    <ol key={keyId} className="my-7 flex flex-col gap-3">
      {lines.map((raw, i) => {
        const l = raw.replace(ORDERED_RE, '').replace(BULLET_RE, '')
        return (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[#2F6B46] text-[12px] font-bold text-[#8FBF9C]">
              {i + 1}
            </span>
            <span className="text-[15px] leading-7 text-[#A7B1A5] sm:text-[16px]">{renderInline(l)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Markdown table (| a | b | rows). First row = header, second = separator. */
function Table({ rows, keyId }: { rows: string[]; keyId: number }) {
  const cells = (row: string) =>
    row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const header = cells(rows[0])
  // Skip the |---|---| separator row if present.
  const bodyRows = rows.slice(/^[\s|:-]+$/.test(rows[1] ?? '') ? 2 : 1).map(cells)
  return (
    <div key={keyId} className="my-7 overflow-x-auto border border-[#1E2723]">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-[#1E2723] bg-white/[0.02] text-left text-[12px] uppercase tracking-wide text-[#6D7A72]">
            {header.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((r, ri) => (
            <tr key={ri} className="border-b border-[#151C16] last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className="px-4 py-2.5 text-[#B7C1B7]">{renderInline(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Own-line image; alt "center"/"wide" tokens set alignment + width. */
function Figure({ alt, src, keyId }: { alt: string; src: string; keyId: number }) {
  const tokens = alt.trim().toLowerCase().split(/\s+/)
  const center = tokens.includes('center')
  const wide = tokens.includes('wide')
  // Remaining words (after stripping the layout tokens) become the caption.
  const caption = alt
    .replace(/\b(center|wide)\b/gi, '')
    .trim()
  const showCaption = caption && caption.toLowerCase() !== 'image'
  return (
    <figure
      key={keyId}
      className={`my-8 ${center ? 'flex flex-col items-center text-center' : ''} ${wide ? 'lg:-mx-16' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS-uploaded photo */}
      <img
        src={src}
        alt={showCaption ? caption : ''}
        loading="lazy"
        className={`border border-[#1E2723] bg-[#0E1A11] object-contain ${center && !wide ? 'max-w-[520px]' : 'w-full'}`}
      />
      {showCaption && (
        <figcaption className="mt-2.5 font-mono text-[11px] leading-relaxed text-[#5E685E]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export function ArticleBody({ body }: { body: string[] }) {
  // Flatten all blocks into one line stream so multi-line constructs inside a
  // single block (numbered lists, tables) parse correctly.
  const lines = body.flatMap((block) => block.split('\n'))
  const blocks: ReactNode[] = []
  let key = 0
  let i = 0

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (trimmed === '') {
      i += 1
      continue
    }

    // ── Fenced blocks: :::tip / :::warning / :::note / :::takeaways / :::steps
    const fence = trimmed.match(/^:::\s*(tip|warning|note|takeaways|steps)\b(.*)$/i)
    if (fence) {
      const kind = fence[1].toLowerCase()
      const inner: string[] = []
      // Content can start on the same line after the token, or on following lines.
      const sameLine = fence[2].trim()
      if (sameLine && sameLine !== ':::') inner.push(sameLine.replace(/:::\s*$/, '').trim())
      i += 1
      while (i < lines.length && lines[i].trim() !== ':::') {
        if (lines[i].trim() !== '') inner.push(lines[i].trim())
        i += 1
      }
      i += 1 // consume closing :::
      blocks.push(
        kind === 'steps'
          ? <Steps key={key++} lines={inner} keyId={key} />
          : <Callout key={key++} kind={kind} lines={inner} keyId={key} />,
      )
      continue
    }

    // ── Ordered list run
    if (ORDERED_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].replace(ORDERED_RE, '').trim())
        i += 1
      }
      blocks.push(
        <ol
          key={key++}
          className="mb-7 flex list-decimal flex-col gap-2.5 pl-6 text-[15px] leading-7 marker:font-semibold marker:text-[#7C8A80] text-[#A7B1A5] sm:text-[16px]"
        >
          {items.map((it, idx) => (
            <li key={idx} className="pl-1">{renderInline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // ── Bullet list run
    if (BULLET_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].replace(BULLET_RE, '').trim())
        i += 1
      }
      blocks.push(
        <ul
          key={key++}
          className="mb-7 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-7 text-[#A7B1A5] sm:text-[16px]"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // ── Table run
    if (isTableRow(line)) {
      const rows: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(lines[i].trim())
        i += 1
      }
      blocks.push(<Table key={key++} rows={rows} keyId={key} />)
      continue
    }

    // ── Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="my-10 border-t border-[#1E2723]" />)
      i += 1
      continue
    }

    // ── Headings
    if (line.startsWith('### ')) {
      const label = line.replace(/^###\s+/, '').trim()
      blocks.push(
        <h3 key={key++} className="mb-3.5 mt-8 text-[19px] font-bold tracking-tight text-[#E4EAE2] sm:text-[20px]">
          {label}
        </h3>,
      )
      i += 1
      continue
    }
    if (line.startsWith('## ')) {
      const label = line.replace(/^##\s+/, '').trim()
      blocks.push(
        <h2 key={key++} id={slugifyHeading(label)} className="mb-4 mt-10 scroll-mt-28 text-[22px] font-bold tracking-tight text-[#F2F6F0] sm:text-[26px]">
          {label}
        </h2>,
      )
      i += 1
      continue
    }

    // ── Own-line image
    const img = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (img) {
      blocks.push(<Figure key={key++} alt={img[1]} src={img[2]} keyId={key} />)
      i += 1
      continue
    }

    // ── Blockquote (consecutive > lines merge into one)
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().replace(/^>\s+/, ''))
        i += 1
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-10 border-l-2 border-[#4FB477] pl-6 text-[18px] font-medium italic leading-relaxed text-[#D7DED4] sm:text-[19px]"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>,
      )
      continue
    }

    // ── Paragraph
    blocks.push(
      <p key={key++} className="mb-5 text-[16px] leading-[1.75] text-[#A7B1A5] sm:text-[17px]">
        {renderInline(line)}
      </p>,
    )
    i += 1
  }

  return <div>{blocks}</div>
}
