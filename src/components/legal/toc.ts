/**
 * Table-of-contents builder for the legal documents (src/lib/legal/documents.ts).
 *
 * Pure and dependency-free so the page, the sticky TOC, the support page's
 * deep links and the unit test all derive anchors from ONE rule:
 *
 *   "1. Introduction"        -> { number: '1', label: 'Introduction', id: '1-introduction' }
 *   "Categories of personal data" -> { number: null, label: …, id: 'categories-of-personal-data' }
 *
 * The heading TEXT is never rewritten (owner-approved legal wording); the
 * number is only split off so it can be typeset separately. Sections without
 * a heading (preambles) get no entry. Ids are unique within a document: a
 * repeated heading gets a `-2`, `-3` suffix.
 */

export interface LegalTocEntry {
  /** Anchor id, stable for a given heading text. */
  id: string
  /** Leading clause number ("1", "12") when the heading carries one. */
  number: string | null
  /** Heading text without its leading number. */
  label: string
  /** Index of the section in `doc.sections`. */
  sectionIndex: number
}

const NUMBERED = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/

/** Split "12. Cancellations before delivery" into its number and label. */
export function parseLegalHeading(heading: string): { number: string | null; label: string } {
  const text = heading.trim()
  const m = NUMBERED.exec(text)
  if (!m) return { number: null, label: text }
  return { number: m[1], label: m[2].trim() }
}

/** URL-safe slug: lowercase ASCII words joined by '-', typographic quotes and marks dropped. */
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** One entry per headed section, in document order. */
export function buildLegalToc(sections: ReadonlyArray<{ h?: string }>): LegalTocEntry[] {
  const seen = new Map<string, number>()
  const out: LegalTocEntry[] = []
  sections.forEach((section, sectionIndex) => {
    if (!section.h || !section.h.trim()) return
    const { number, label } = parseLegalHeading(section.h)
    const base = slugifyHeading(number ? `${number} ${label}` : label) || `section-${sectionIndex + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    out.push({ id: count === 1 ? base : `${base}-${count}`, number, label, sectionIndex })
  })
  return out
}

/**
 * The anchor of the first section whose heading label starts with `prefix`
 * (case-insensitive), or null. Used for deep links into a policy from other
 * pages, so a renumbered clause can't silently break the link — the test
 * asserts every such link still resolves.
 */
export function findLegalAnchor(
  sections: ReadonlyArray<{ h?: string }>,
  prefix: string,
): string | null {
  const want = prefix.trim().toLowerCase()
  const hit = buildLegalToc(sections).find((e) => e.label.toLowerCase().startsWith(want))
  return hit ? hit.id : null
}
