/**
 * V46 — Legal document page renderer.
 *
 * Renders a LegalDoc from src/lib/legal/documents.ts in the site design
 * system: document header with entity meta, sectioned body (paragraphs,
 * lists, tables, warning notes), and a cross-link strip to the other
 * legal documents. Content supports **bold** and *italic* inline marks.
 */

import Link from 'next/link'
import { Fragment } from 'react'
import { LEGAL_DOCS, LEGAL_ENTITY, type LegalBlock, type LegalDoc } from '@/lib/legal/documents'

/** Minimal inline renderer: **bold** and *italic*. */
function Inline({ md }: { md: string }) {
  // Split on **bold** first, then *italic* within the plain runs.
  const parts = md.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-text-primary">
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

function Block({ block }: { block: LegalBlock }) {
  switch (block.t) {
    case 'p':
      return (
        <p className="text-[15px] leading-[1.75] text-text-secondary">
          <Inline md={block.md} />
        </p>
      )
    case 'ul':
      return (
        <ul className="space-y-2 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-disc text-[15px] leading-[1.7] text-text-secondary marker:text-lime"
            >
              <Inline md={item} />
            </li>
          ))}
        </ul>
      )
    case 'table': {
      // 3+ column tables crush to unreadably narrow columns on phones, so
      // below md they render as stacked definition cards (first cell = card
      // title, remaining head/cell pairs = label/value rows). The true
      // <table> stays for md+ and for 2-column tables, which fit fine.
      const isWide = block.head.length >= 3
      const table = (
        <div
          className={
            isWide
              ? 'hidden overflow-x-auto rounded-xl border border-border-default md:block'
              : 'overflow-x-auto rounded-xl border border-border-default'
          }
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-bg-overlay">
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-border-default px-4 py-3 text-[13px] font-bold uppercase tracking-wider text-text-primary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="odd:bg-white/[0.02]">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={
                        j === 0
                          ? 'border-b border-border-subtle px-4 py-3 text-[14px] font-semibold text-text-primary'
                          : 'border-b border-border-subtle px-4 py-3 text-[14px] text-text-secondary'
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
          <div className="space-y-3 md:hidden">
            {block.rows.map((row, i) => (
              <div
                key={i}
                className="rounded-xl border border-border-default bg-white/[0.02] p-4"
              >
                <div className="text-[14px] font-semibold leading-snug text-text-primary">
                  {row[0]}
                </div>
                <dl className="mt-3 space-y-2.5">
                  {row.slice(1).map((cell, j) => (
                    <div key={j}>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                        {block.head[j + 1]}
                      </dt>
                      <dd className="mt-0.5 text-[14px] leading-relaxed text-text-secondary">
                        {cell}
                      </dd>
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
        <div className="rounded-xl border border-warning/30 bg-warning-bg/30 px-4 py-3 text-[14px] leading-relaxed text-warning">
          <Inline md={block.md} />
        </div>
      )
  }
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="min-h-screen pb-24">
      <article className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
        {/* Header */}
        <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
          Legal
        </div>
        <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] tracking-tight text-text-primary sm:text-[36px]">
          {doc.title}
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-tertiary">
          Effective: {LEGAL_ENTITY.effectiveDate} · Last updated: {LEGAL_ENTITY.lastUpdated} ·
          Governing law: {LEGAL_ENTITY.jurisdiction}
        </p>
        <p className="mt-1 text-[13.5px] text-text-tertiary">
          {LEGAL_ENTITY.name} · Company No. {LEGAL_ENTITY.companyNumber} ·{' '}
          <a
            href={`mailto:${LEGAL_ENTITY.email}`}
            className="text-text-secondary underline-offset-2 hover:text-lime-text hover:underline"
          >
            {LEGAL_ENTITY.email}
          </a>
        </p>

        <div aria-hidden className="mt-6 h-px w-full bg-[linear-gradient(to_right,#C6FF3D66,transparent_40%)]" />

        {/* Body */}
        <div className="mt-8 space-y-8">
          {doc.sections.map((section, i) => (
            <section key={i} className="space-y-4">
              {section.h && (
                <h2 className="text-[19px] font-bold leading-snug text-text-primary sm:text-[21px]">
                  {section.h}
                </h2>
              )}
              {section.blocks.map((block, j) => (
                <Block key={j} block={block} />
              ))}
            </section>
          ))}
        </div>

        {/* Cross-links to the rest of the pack */}
        <nav aria-label="Legal documents" className="mt-14 border-t border-border-subtle pt-8">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
            All legal documents
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className={
                  d.slug === doc.slug
                    ? 'inline-block py-1.5 text-[13px] font-semibold text-lime-text'
                    : 'inline-block py-1.5 text-[13px] text-text-tertiary transition-colors hover:text-text-primary'
                }
              >
                {d.title}
              </Link>
            ))}
          </div>
        </nav>
      </article>
    </main>
  )
}
