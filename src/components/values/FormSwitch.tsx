'use client'

/**
 * The value-list card's form switch (owner, 2026-10-23: one "Chroma" button
 * under a Standard price read as the Chroma price). Two halves, Standard |
 * Chroma, in one slim tray split by a hairline; the active half is filled
 * edge to edge (no pill inside a tray) and the fill slides between halves
 * on a critically damped spring. Chroma lettering keeps MM2's iridescent
 * finish when it is the active form. The price labels under it name the same
 * form, so the card never shows one form's price under the other's name.
 */
import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChromaWord, type CardForm } from './ChromaWord'

export function FormSwitch({
  form,
  onChange,
  itemName,
  chromaLabel = 'Chroma',
}: {
  form: CardForm
  onChange: (form: CardForm) => void
  itemName: string
  chromaLabel?: string
}) {
  const reduce = useReducedMotion()
  // One fill per card: layoutId must be unique across the grid.
  const fillId = useId()
  const options: { key: CardForm; label: string }[] = [
    { key: 'standard', label: 'Standard' },
    { key: 'chroma', label: chromaLabel },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={`${itemName}: show the Standard or ${chromaLabel} version`}
      className="mx-auto grid h-8 w-full max-w-[13rem] grid-cols-2 divide-x divide-white/[0.08] overflow-hidden rounded-md border border-white/[0.08]"
    >
      {options.map((o) => {
        const active = form === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(o.key)}
            className={`relative isolate text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
              active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {active && (
              <motion.span
                aria-hidden
                layoutId={fillId}
                className="absolute inset-0 -z-10 bg-white/[0.09]"
                transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.3 }}
              />
            )}
            {o.key === 'chroma' && active ? <ChromaWord>{o.label}</ChromaWord> : o.label}
          </button>
        )
      })}
    </div>
  )
}
