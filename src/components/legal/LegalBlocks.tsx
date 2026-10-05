/**
 * Block renderers for a legal document's content (src/lib/legal/documents.ts).
 * Presentation only — the wording is the owner-approved text and is rendered
 * verbatim. Content supports **bold**, *italic* and [text](/path) inline marks.
 *
 * A bullet list whose every item opens with a quoted bold term
 * (“**Buyer**” — …) is a definitions list and is typeset as one: a flat card
 * with hairline rows, the same text inside.
 */

import { Fragment } from 'react'
import Link from '@/components/navigation/AppLink'
import type { LegalBlock } from '@/lib/legal/documents'

const LINK_CLS =
  'font-medium text-text-primary underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70 print:text-black print:no-underline'

/** Minimal inline renderer: **bold**, *italic* and [text](/internal-path) links. */
export function LegalInline({ md }: { md: string }) {
  // Split on [text](href) and **bold** first, then *italic* within the plain runs.
  const parts = md.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          return (
            <Link key={i} href={link[2]} className={LINK_CLS}>
              {link[1]}
            </Link>
          )
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-text-primary print:text-black">
              {part.slice(2, -2)}
            </strong>
          )
        }
        const italics = part.split(/(\*[^*]+\*)/g)
        return (
          <Fragment key={i}>
            {italics.map((seg, j) =>
              seg.startsWith('*') && seg.endsWith('*') && seg.length > 2 ? (
                <em key={j}>{seg.slice(1, -1)}</em>
              ) : (
                <Fragment key={j}>{seg}</Fragment>
              ),
            )}
          </Fragment>
        )
      })}
    </>
  )
}

/** True when every item starts with a quoted bold term: “**Term**” … */
export function isDefinitionList(items: readonly string[]): boolean {
  return items.length >= 2 && items.every((item) => /^[“"]\*\*[^*]+\*\*[”"]/.test(item.trim()))
}

const BODY = 'text-[15px] leading-[1.75] text-text-secondary print:text-black'

export function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.t) {
    case 'p':
      return (
        <p className={BODY}>
          <LegalInline md={block.md} />
        </p>
      )
    case 'ul':
      if (isDefinitionList(block.items)) {
        return (
          <ul
            aria-label="Definitions"
            className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised print:divide-black/20 print:bg-transparent"
          >
            {block.items.map((item, i) => (
              <li key={i} className="px-4 py-3 text-[14.5px] leading-[1.65] text-text-secondary sm:px-5 print:px-0 print:text-black">
                <LegalInline md={item} />
              </li>
            ))}
          </ul>
        )
      }
      return (
        <ul className="space-y-2 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-disc text-[15px] leading-[1.7] text-text-secondary marker:text-white/30 print:text-black print:marker:text-black"
            >
              <LegalInline md={item} />
            </li>
          ))}
        </ul>
      )
    case 'table': {
      // 3+ column tables crush to unreadably narrow columns on phones, so
      // below md they render as stacked definition cards (first cell = card
      // title, remaining head/cell pairs = label/value rows). The true
      // <table> stays for md+ (and print) and for 2-column tables.
      const isWide = block.head.length >= 3
      const table = (
        <div
          className={
            (isWide ? 'hidden md:block print:block ' : '') +
            'overflow-x-auto overscroll-x-contain rounded-lg bg-bg-raised print:bg-transparent'
          }
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-white/[0.07] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-tertiary print:border-black/30 print:text-black"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.07] last:border-b-0 print:border-black/20">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={
                        j === 0
                          ? 'px-4 py-3 align-top text-[14px] font-medium text-text-primary print:text-black'
                          : 'px-4 py-3 align-top text-[14px] text-text-secondary print:text-black'
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      if (!isWide) return table
      return (
        <div>
          <div className="space-y-2 md:hidden print:hidden">
            {block.rows.map((row, i) => (
              <div key={i} className="rounded-lg bg-bg-raised p-4">
                <div className="text-[14px] font-semibold leading-snug text-text-primary">{row[0]}</div>
                <dl className="mt-3 space-y-2.5">
                  {row.slice(1).map((cell, j) => (
                    <div key={j}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                        {block.head[j + 1]}
                      </dt>
                      <dd className="mt-0.5 text-[14px] leading-relaxed text-text-secondary">{cell}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {table}
        </div>
      )
    }
    case 'note':
      return (
        <div
          role="note"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-4 py-3 text-[14px] leading-relaxed text-warning print:bg-transparent print:px-0 print:text-black"
        >
          <LegalInline md={block.md} />
        </div>
      )
  }
}
