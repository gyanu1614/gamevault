/**
 * The ONE layout every legal document renders through (the routes under
 * src/app/(legal) call it with a LegalDoc from src/lib/legal/documents.ts;
 * /fees renders from (marketing) with its document's fee terms at the bottom).
 *
 * Structure follows how mature marketplaces and GOV.UK present legal text:
 *   - Document header: title, summary, effective date / last updated +
 *     version (per document, falling back to LEGAL_ENTITY) / governing law,
 *     issuing entity, Print.
 *   - Contents: sticky "On This Page" rail on desktop with scroll-spy; a
 *     collapsed disclosure on phones. Built from the headings by toc.ts.
 *   - Body: headings carry stable #anchors with a copy-link button; the
 *     clause number is typeset apart from the label; the text column is held
 *     to a ~70ch reading measure.
 *   - After the body: a contact block for legal queries, "Related Policies",
 *     and the grouped index of every document in the pack.
 *   - Print: only the document prints (site chrome, rails and buttons drop
 *     out), black on white, with the page URL under the title.
 *
 * WORDING: the legal text is owner-approved and rendered verbatim — this file
 * changes presentation only. Server component; the TOC highlight, copy-link
 * and print buttons are small client islands.
 */

import Link from '@/components/navigation/AppLink'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/ssr/CalendarBlank'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ClockCounterClockwise'
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react/dist/ssr/GlobeHemisphereWest'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { LEGAL_ENTITY, type LegalDoc } from '@/lib/legal/documents'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { LegalBlockView } from './LegalBlocks'
import { LegalToc } from './LegalToc'
import { CopySectionLink, PrintButton } from './LegalActions'
import { buildLegalToc, type LegalTocEntry } from './toc'
import { groupedLegalDocs, legalDocHref, legalPageParts, partAnchor, relatedLegalDocs } from './legal-nav'
import { KEY_POINTS } from '@/lib/legal/key-points'
import type { LegalSection } from '@/lib/legal/documents'

/** Under the navbar (its height + any announcement banner) with a little air. */
const STICKY_TOP = 'top-[calc(var(--navbar-bottom)+24px)]'
const ANCHOR_OFFSET = 'scroll-mt-[calc(var(--navbar-bottom)+24px)]'

/**
 * Print: hide every element that is neither the document root, inside it,
 * nor one of its ancestors — so the navbar, footer and banners drop out
 * without the layout knowing about this page.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 18mm 16mm; }
  html, body { background: #fff !important; }
  body *:not(:has(.legal-print-root)):not(.legal-print-root):not(.legal-print-root *) { display: none !important; }
  .legal-print-root, .legal-print-root * { color: #000 !important; box-shadow: none !important; }
  .legal-print-root h2 { break-after: avoid; }
  .legal-print-root table, .legal-print-root li { break-inside: avoid; }
}
`

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 print:px-0 print:py-1">
      <span aria-hidden className="mt-[2px] text-text-tertiary print:hidden">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">{label}</dt>
        <dd className="mt-0.5 text-[14px] font-medium text-text-primary">{value}</dd>
      </div>
    </div>
  )
}

function DocIndex({ currentSlug, compact = false }: { currentSlug: string; compact?: boolean }) {
  const groups = groupedLegalDocs()
  return (
    <nav aria-label="Legal documents" className="print:hidden">
      {compact && (
        <p className="px-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          Legal Documents
        </p>
      )}
      <div className={compact ? 'mt-2 space-y-4' : 'grid gap-8 sm:grid-cols-2 lg:grid-cols-3'}>
        {groups.map((g) => (
          <div key={g.title}>
            <p
              className={
                compact
                  ? 'px-3 text-[11.5px] font-medium text-text-tertiary'
                  : 'text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary'
              }
            >
              {g.title}
            </p>
            <ul className={compact ? 'mt-1 space-y-0.5' : 'mt-3 space-y-1'}>
              {g.docs.map((d) => {
                const current = d.slug === currentSlug
                return (
                  <li key={d.slug}>
                    <Link
                      href={legalDocHref(d.slug)}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'block rounded-md transition-colors',
                        compact ? 'px-3 py-1.5 text-[13px] leading-snug' : 'py-1.5 text-[14px]',
                        current
                          ? cn('font-semibold text-text-primary', compact && 'bg-white/[0.06]')
                          : cn('text-text-secondary hover:text-text-primary', compact && 'hover:bg-white/[0.04]'),
                      )}
                    >
                      {d.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function SectionHeading({ entry, level = 2 }: { entry: LegalTocEntry; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <H
      id={entry.id}
      className={cn(
        'group/heading flex items-start font-semibold leading-snug tracking-[-0.01em] text-text-primary',
        level === 2 ? 'text-[19px] sm:text-[21px]' : 'text-[17px] sm:text-[18px]',
        ANCHOR_OFFSET,
      )}
    >
      <span className="min-w-0">
        {entry.number && <span className="mr-2 tabular-nums text-text-tertiary">{entry.number}.</span>}
        {entry.label}
      </span>
      <CopySectionLink id={entry.id} label={entry.label} />
    </H>
  )
}

/** Words a reader works through, for the "min read" line (BIT 2019: showing reading time raised opens). */
function wordCount(sections: readonly LegalSection[]): number {
  return JSON.stringify(sections.map((sec) => [sec.h, sec.blocks])).replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).length
}

/** The sections of one document, numbered headings as anchors (a part's ids carry its slug). */
function DocSections({ sections, idPrefix = '', level = 2 }: { sections: readonly LegalSection[]; idPrefix?: string; level?: 2 | 3 }) {
  const toc = buildLegalToc(sections).map((e) => ({ ...e, id: idPrefix + e.id }))
  const bySection = new Map(toc.map((e) => [e.sectionIndex, e]))
  return (
    <>
      {sections.map((section, i) => {
        const entry = bySection.get(i)
        return (
          <section
            key={i}
            aria-labelledby={entry?.id}
            className={cn('space-y-4', i > 0 && entry && 'border-t border-white/[0.07] pt-10 print:border-black/20')}
          >
            {entry && <SectionHeading entry={entry} level={level} />}
            {section.blocks.map((block, j) => (
              <LegalBlockView key={j} block={block} />
            ))}
          </section>
        )
      })}
    </>
  )
}

/**
 * Key Points: questions and answers above the document, marked as a summary
 * (lib/legal/key-points). Always open: collapsed summaries lowered
 * understanding in the UK government's tests.
 */
function KeyPoints({ points }: { points: readonly { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="key-points" className="mt-8 rounded-lg bg-bg-raised p-5 sm:p-6 print:bg-transparent print:p-0">
      <h2 id="key-points" className="text-[17px] font-semibold text-text-primary">
        Key Points
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
        A plain summary to help you read this page. It is not part of the terms; the full text below is what applies.
      </p>
      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.q}>
            <dt className="text-[14.5px] font-semibold text-text-primary">{p.q}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-text-secondary">{p.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const parts = legalPageParts(doc.slug)
  // The page contents: the document's own headings, then one entry per part.
  const toc: LegalTocEntry[] = [
    ...buildLegalToc(doc.sections),
    ...parts.map((part, i) => ({ id: partAnchor(part.slug), number: null, label: part.title, sectionIndex: -1 - i })),
  ]
  const hasToc = toc.length >= 2
  const keyPoints = KEY_POINTS[doc.slug]
  const minutes = Math.max(1, Math.round((wordCount(doc.sections) + parts.reduce((n, part) => n + wordCount(part.sections), 0)) / 230))
  const related = relatedLegalDocs(doc.slug)
  const href = legalDocHref(doc.slug)

  return (
    <main className="min-h-screen bg-bg-base pb-24 print:min-h-0 print:bg-white print:pb-0">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 print:max-w-none print:px-0 print:pt-0">
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          {/* ── Desktop rail ───────────────────────────────────────────── */}
          <aside className="hidden lg:block print:hidden">
            <div
              className={cn(
                'sticky max-h-[calc(100vh-var(--navbar-bottom)-48px)] space-y-8 overflow-y-auto overscroll-contain pb-6',
                STICKY_TOP,
              )}
            >
              {hasToc ? (
                <LegalToc entries={toc} variant="sidebar" />
              ) : (
                <DocIndex currentSlug={doc.slug} compact />
              )}
            </div>
          </aside>

          <article className="legal-print-root min-w-0 max-w-[72ch]">
            {/* ── Document header ─────────────────────────────────────── */}
            <header>
              <div className="flex items-center justify-between gap-4">
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary">
                  <ScalesIcon size={15} weight="bold" aria-hidden className="print:hidden" /> Legal
                </p>
                <PrintButton className="hidden sm:inline-flex" />
              </div>
              <h1 className="mt-3 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-text-primary sm:text-[40px]">
                {doc.title}
              </h1>
              <p className="mt-2 hidden text-[12px] print:block">
                {LEGAL_ENTITY.website}
                {href}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-text-secondary print:hidden">{doc.description}</p>
              <p className="mt-2 text-[13px] text-text-tertiary print:hidden">
                {minutes} min read
                {parts.length > 0 && <> · Includes {parts.map((part) => part.title).join(', ')}</>}
              </p>

              <dl className="mt-6 grid divide-y divide-white/[0.07] rounded-lg bg-bg-raised sm:grid-cols-3 sm:divide-x sm:divide-y-0 print:grid-cols-3 print:divide-none print:bg-transparent">
                <MetaItem
                  icon={<CalendarBlankIcon size={15} weight="bold" />}
                  label="Effective"
                  value={LEGAL_ENTITY.effectiveDate}
                />
                <MetaItem
                  icon={<ClockCounterClockwiseIcon size={15} weight="bold" />}
                  label="Last Updated"
                  value={`${doc.lastUpdated ?? LEGAL_ENTITY.lastUpdated} · ${doc.version ?? LEGAL_ENTITY.version}`}
                />
                <MetaItem
                  icon={<GlobeHemisphereWestIcon size={15} weight="bold" />}
                  label="Governing Law"
                  value={LEGAL_ENTITY.jurisdiction}
                />
              </dl>
              <p className="mt-3 text-[13px] leading-relaxed text-text-tertiary">
                Issued by {LEGAL_ENTITY.name} · Company No. {LEGAL_ENTITY.companyNumber} ·{' '}
                <a
                  href={`mailto:${LEGAL_ENTITY.email}`}
                  className="text-text-secondary underline decoration-white/20 underline-offset-4 transition-colors hover:text-text-primary hover:decoration-white/60"
                >
                  {LEGAL_ENTITY.email}
                </a>
              </p>
            </header>

            {keyPoints && <KeyPoints points={keyPoints} />}

            {hasToc && (
              <div className="mt-6 lg:hidden">
                <LegalToc entries={toc} variant="disclosure" />
              </div>
            )}

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="mt-10 space-y-10">
              <DocSections sections={doc.sections} />
            </div>

            {/* ── Parts: documents read on this page, wording and numbering unchanged ── */}
            {parts.map((part) => (
              <section
                key={part.slug}
                aria-labelledby={partAnchor(part.slug)}
                className="mt-16 border-t-2 border-white/[0.12] pt-12 print:border-black/30"
              >
                <h2
                  id={partAnchor(part.slug)}
                  className={cn('text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]', ANCHOR_OFFSET)}
                >
                  {part.title}
                </h2>
                <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">{part.description}</p>
                <p className="mt-2 text-[13px] text-text-tertiary">
                  Last updated {part.lastUpdated ?? LEGAL_ENTITY.lastUpdated} · {part.version ?? LEGAL_ENTITY.version}
                </p>
                <div className="mt-8 space-y-10">
                  <DocSections sections={part.sections} idPrefix={`${part.slug}-`} level={3} />
                </div>
              </section>
            ))}

            {/* ── Contact for legal queries ───────────────────────────── */}
            <aside
              aria-labelledby="legal-contact"
              className="mt-14 rounded-lg bg-bg-raised p-5 sm:p-6 print:mt-10 print:bg-transparent print:p-0"
            >
              <h2 id="legal-contact" className="text-[16px] font-semibold text-text-primary">
                Questions About This Document?
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                Contact {LEGAL_ENTITY.name} at{' '}
                <a
                  href={`mailto:${LEGAL_ENTITY.email}`}
                  className="font-medium text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                >
                  {LEGAL_ENTITY.email}
                </a>
                . Registered in {LEGAL_ENTITY.jurisdiction}, Company No. {LEGAL_ENTITY.companyNumber}. Registered
                office: {LEGAL_ENTITY.registeredOffice}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <a
                  href={`mailto:${LEGAL_ENTITY.email}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-white/[0.06] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.10]"
                >
                  <EnvelopeSimpleIcon size={15} weight="bold" aria-hidden /> Email Us
                </a>
                {doc.slug !== 'complaints' && (
                  <Link
                    href="/complaints"
                    className="inline-flex h-9 items-center rounded-md bg-white/[0.06] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.10]"
                  >
                    Make a Complaint
                  </Link>
                )}
                <Link
                  href="/support"
                  className="inline-flex h-9 items-center rounded-md bg-white/[0.06] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.10]"
                >
                  Help Centre
                </Link>
              </div>
            </aside>

            {/* ── Related policies ────────────────────────────────────── */}
            {related.length > 0 && (
              <section aria-labelledby="legal-related" className="mt-14 print:hidden">
                <h2 id="legal-related" className="text-[18px] font-semibold text-text-primary">
                  Related Policies
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={legalDocHref(d.slug)}
                        className={cn('group flex h-full flex-col rounded-lg p-4', MARKET_CARD, MARKET_CARD_HOVER)}
                      >
                        <span className="flex items-center justify-between gap-3 text-[14.5px] font-semibold text-text-primary">
                          {d.title}
                          <ArrowRightIcon
                            size={14}
                            weight="bold"
                            aria-hidden
                            className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-text-tertiary">
                          {d.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>

        {/* ── Every document in the pack ─────────────────────────────── */}
        <div className="mt-16 border-t border-white/[0.07] pt-10 print:hidden">
          <h2 className="mb-6 text-[18px] font-semibold text-text-primary">All Legal Documents</h2>
          <DocIndex currentSlug={doc.slug} />
        </div>
      </div>
    </main>
  )
}
