/**
 * Renders a DB post body into the article design.
 *
 * Bodies are stored as `string[]` — one entry per block — using a small
 * markdown subset the file-based posts already used:
 *   "## Heading"      → h2 (also becomes a TOC anchor)
 *   "### Subheading"  → h3
 *   "- item"          → bulleted list (consecutive "- " lines group)
 *   "> quote"         → pull quote
 *   anything else     → paragraph, with [text](href) inline links
 *
 * No table/FAQ/takeaways are synthesised: we only render what a post actually
 * contains, so nothing here can invent data. Headings are slugged for the TOC.
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

/** Extract the h2 headings up-front so the page can render a TOC sidebar. */
export function extractToc(body: string[]): TocEntry[] {
  return body
    .filter((line) => line.startsWith('## ') && !line.startsWith('### '))
    .map((line) => {
      const label = line.replace(/^##\s+/, '').trim()
      return { id: slugifyHeading(label), label }
    })
}

/** Inline `[text](href)` → <Link>. Internal links route client-side. */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [, label, href] = m
    parts.push(
      href.startsWith('/') ? (
        <Link
          key={key++}
          href={href}
          className="text-[#8FBF9C] underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      ) : (
        <a
          key={key++}
          href={href}
          className="text-[#8FBF9C] underline-offset-2 hover:underline"
          rel="nofollow noopener"
          target="_blank"
        >
          {label}
        </a>
      ),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function ArticleBody({ body }: { body: string[] }) {
  const blocks: ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  const flushList = () => {
    if (listBuffer.length === 0) return
    const items = listBuffer
    listBuffer = []
    blocks.push(
      <ul
        key={key++}
        className="mb-7 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-7 text-[#A7B1A5] sm:text-[16px]"
      >
        {items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </ul>,
    )
  }

  for (const raw of body) {
    const line = raw.trimEnd()

    if (line.startsWith('- ')) {
      listBuffer.push(line.replace(/^-\s+/, ''))
      continue
    }
    flushList()

    if (line.startsWith('### ')) {
      const label = line.replace(/^###\s+/, '').trim()
      blocks.push(
        <h3
          key={key++}
          className="mb-3.5 mt-8 text-[19px] font-bold tracking-tight text-[#E4EAE2] sm:text-[20px]"
        >
          {label}
        </h3>,
      )
    } else if (line.startsWith('## ')) {
      const label = line.replace(/^##\s+/, '').trim()
      blocks.push(
        <h2
          key={key++}
          id={slugifyHeading(label)}
          className="mb-4 mt-10 scroll-mt-28 text-[22px] font-bold tracking-tight text-[#F2F6F0] sm:text-[26px]"
        >
          {label}
        </h2>,
      )
    } else if (/^!\[[^\]]*\]\([^)]+\)$/.test(line.trim())) {
      // Image block: ![caption](url) on its own line. Rendered as a bordered
      // figure with a mono caption, matching the article design.
      const m = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (m) {
        const [, alt, src] = m
        blocks.push(
          <figure key={key++} className="my-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- CMS-uploaded photo */}
            <img
              src={src}
              alt={alt || ''}
              loading="lazy"
              className="w-full border border-[#1E2723] bg-[#0E1A11] object-cover"
            />
            {alt && alt !== 'Image' && (
              <figcaption className="mt-2.5 font-mono text-[11px] leading-relaxed text-[#5E685E]">
                {alt}
              </figcaption>
            )}
          </figure>,
        )
      }
    } else if (line.startsWith('> ')) {
      blocks.push(
        <blockquote
          key={key++}
          className="my-10 border-l-2 border-[#4FB477] pl-6 text-[18px] font-medium italic leading-relaxed text-[#D7DED4] sm:text-[19px]"
        >
          {renderInline(line.replace(/^>\s+/, ''))}
        </blockquote>,
      )
    } else if (line.length > 0) {
      blocks.push(
        <p
          key={key++}
          className="mb-5 text-[16px] leading-[1.75] text-[#A7B1A5] sm:text-[17px]"
        >
          {renderInline(line)}
        </p>,
      )
    }
  }
  flushList()

  return <div>{blocks}</div>
}
