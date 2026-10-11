'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { type Attribute, type AttributeTemplateFull } from '@/lib/actions/new-schema'
import { isVisible, labelFor } from '@/app/(sell)/_components/sell-wizard/attribute-tree'
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
    <motion.div
      layout
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
            {/* Follow-up questions for the picked choice: a plain row under a
                hairline, not a box inside the card. */}
            <div className="mt-4 border-t border-white/[0.07] pt-4">
              <div className="mb-3 text-[12.5px] text-text-tertiary">
                {attribute.name}: <span className="font-semibold text-lime-text">{labelFor(attribute, currentValue as string)}</span>
              </div>
              <div className="space-y-3">
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
