'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { type Attribute, type AttributeTemplateFull } from '@/lib/actions/new-schema'
import { isVisible, labelFor, walkAndClear } from '@/app/(sell)/_components/sell-wizard/attribute-tree'
import { FieldInput } from '@/app/(sell)/_components/sell-wizard/steps/FieldInput'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'

// ─── Step 3: dynamic details (with nested sub-fields) ────────────────────────

export function Step3Details({
  templateLoading, template, topLevel, childrenOf, values, onChange,
}: {
  templateLoading: boolean
  template: AttributeTemplateFull | null
  topLevel: Attribute[]
  childrenOf: Map<string, Map<string, Attribute[]>>
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
}) {
  // R8 — when there are no admin-defined extra fields for this (game, category),
  // skip the Offer Details sub-card entirely. The seller starts straight at the
  // Title card. Loading state still renders so the UI doesn't flash.
  if (templateLoading) {
    return (
      <SubCard title="Offer Details">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          Loading details…
        </div>
      </SubCard>
    )
  }
  if (!template || topLevel.length === 0) return null

  return (
    <SubCard title="Offer Details">
      <div className="space-y-4">
        {topLevel.map((a) => (
          <FieldCard
            key={a.id}
            attribute={a}
            values={values}
            onChange={onChange}
            childrenOf={childrenOf}
            depth={0}
          />
        ))}
      </div>
    </SubCard>
  )
}

/**
 * FieldCard — renders a single attribute and, if it has children that are
 * revealed by the current value, recursively renders those children
 * indented INSIDE this card.
 */
export function FieldCard({
  attribute, values, onChange, childrenOf, depth,
}: {
  attribute: Attribute
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
  childrenOf: Map<string, Map<string, Attribute[]>>
  depth: number
}) {
  if (!isVisible(attribute, values)) return null

  const inner = childrenOf.get(attribute.id)
  const currentValue = values[attribute.id]
  const revealedKids = inner && typeof currentValue === 'string' && currentValue
    ? inner.get(currentValue) ?? []
    : []

  // V19/P20 — Inside the SubCard wrapper, top-level fields are flat rows;
  // nested (depth > 0) fields previously used bg-bg-inset which made them
  // read as a black hole sitting inside the lime rail. Switching to a
  // slightly raised tone (bg-bg-overlay at 30%) keeps the hierarchy cue
  // without the heavy contrast.
  // Mobile trims the nested shell padding (~18px saved per level) so
  // depth-2 inputs keep a usable width inside a 360px viewport.
  const shell = depth === 0
    ? ''
    : 'rounded-xl border border-border-subtle bg-[color-mix(in_srgb,var(--color-bg-overlay)_30%,transparent)] p-3 sm:p-4'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={shell}
    >
      <FieldInput
        attribute={attribute}
        value={currentValue}
        onChange={(v) => {
          // If the user changes the parent value, drop any descendant values
          // so we don't leave stale data attached to a hidden branch.
          if (inner) {
            const nextValues = { ...values, [attribute.id]: v }
            // Clear any kids that were revealed by the OLD value
            const oldKids = typeof currentValue === 'string' ? inner.get(currentValue) ?? [] : []
            for (const kid of oldKids) {
              delete (nextValues as any)[kid.id]
              // recursively walk further descendants
              walkAndClear(kid, childrenOf, nextValues)
            }
            // Apply: we use onChange repeatedly so the reducer in the parent
            // stays simple. The bulk delete is rare and the list is short.
            Object.entries(nextValues).forEach(([k, val]) => onChange(k, val))
          } else {
            onChange(attribute.id, v)
          }
        }}
      />

      {/* Nested sub-fields (animated) */}
      <AnimatePresence initial={false}>
        {revealedKids.length > 0 && (
          <motion.div
            key="nested"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* V19/P20 — Sub-field group. Lime left rail + a tiny
                eyebrow signal "this group depends on the parent". The
                eyebrow now sits on its own line above the cards with
                a clear breath, not crammed against them. */}
            <div className="mt-4 border-l-2 border-lime-tint-border pl-3 sm:pl-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <span className="text-text-secondary">{attribute.name}:</span>{' '}
                <span className="text-lime-text">{labelFor(attribute, currentValue as string)}</span>
              </div>
              <div className="space-y-3">
                {revealedKids.map((kid) => (
                  <FieldCard
                    key={kid.id}
                    attribute={kid}
                    values={values}
                    onChange={onChange}
                    childrenOf={childrenOf}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
