'use client'


// ─── SubCard — one labelled section of the Details step ────────────────────

/**
 * SubCard wraps a labelled section of the Details step.
 *
 * Despite the name it is not a card: the focused-canvas layout dropped
 * the wizard's outer panel, and a bordered section inside a borderless
 * page just reintroduces the nesting. It renders a heading, a hairline,
 * and the section's fields; spacing does the grouping.
 */
export function SubCard({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Each section is its own panel: a title bar, a hairline, then the
    // fields. Rectangular (rounded-lg, not a pill) per the house card
    // language. The divider is the only line inside the panel, so the
    // title reads as a header rather than another field label.
    <section className="scroll-mt-28 overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay">
      {/* Compact title bar: the divider sits just under the title so the
          bar reads as a label for the panel, not a section of its own. */}
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border-subtle px-4 py-2 sm:px-5">
        <h2 className="text-[14.5px] font-bold leading-tight tracking-tight text-text-primary">
          {title}
        </h2>
        {right}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}
