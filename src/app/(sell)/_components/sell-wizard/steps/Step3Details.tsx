'use client'

import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { type Attribute, type AttributeTemplateFull } from '@/lib/actions/new-schema'
import { isVisible } from '@/app/(sell)/_components/sell-wizard/attribute-tree'
import { FieldInput } from '@/app/(sell)/_components/sell-wizard/steps/FieldInput'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'

// ─── Step 3: dynamic details (with nested sub-fields) ────────────────────────

/**
 * memo: the wizard keeps every field in one form object, so typing a title or
 * price re-rendered (and re-sorted) every dropdown here. `values` is the
 * fieldValues object, which only changes when an item field does.
 */
export const Step3Details = memo(function Step3Details({
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
    // Sized like the real fields (label + box), so nothing jumps when
    // they arrive.
    return (
      <SubCard title="Offer Details">
        <div className="space-y-5" aria-busy="true" aria-label="Loading item fields">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="mb-2 h-3.5 w-24 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
              <div className="h-11 animate-pulse rounded-md bg-white/[0.04] motion-reduce:animate-none sm:h-10" />
            </div>
          ))}
        </div>
      </SubCard>
    )
  }
  if (!template || topLevel.length === 0) return null

  return (
    <SubCard title="Offer Details">
      <div className="space-y-5">
        {topLevel.map((a) => (
          <FieldCard
            key={a.id}
            attribute={a}
            values={values}
            onChange={onChange}
            childrenOf={childrenOf}
          />
        ))}
      </div>
    </SubCard>
  )
})

/**
 * FieldCard — renders a single attribute and, if it has children that are
 * revealed by the current value, recursively renders those children
 * indented INSIDE this card.
 */
export function FieldCard({
  attribute, values, onChange, childrenOf,
}: {
  attribute: Attribute
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
  childrenOf: Map<string, Map<string, Attribute[]>>
}) {
  if (!isVisible(attribute, values)) return null

  const inner = childrenOf.get(attribute.id)
  const currentValue = values[attribute.id]
  const revealedKids = inner && typeof currentValue === 'string' && currentValue
    ? inner.get(currentValue) ?? []
    : []

  return (
    // No `layout`: it measured the whole card on every keystroke.
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <FieldInput
        attribute={attribute}
        value={currentValue}
        // The wizard clears the old choice's sub-fields (collectDescendantIds)
        // and applies option sets, in one update.
        onChange={(v) => onChange(attribute.id, v)}
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
            {/* Follow-up fields for the pick: the same label-over-field rows,
                same spacing, no echo line or divider (owner, 2026-10-12:
                Eldorado's calm stack). */}
            <div className="pt-5">
              <div className="space-y-5">
                {revealedKids.map((kid) => (
                  <FieldCard
                    key={kid.id}
                    attribute={kid}
                    values={values}
                    onChange={onChange}
                    childrenOf={childrenOf}
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
