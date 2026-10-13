'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { FieldColumn } from './FieldColumn'
import type { Column } from './builder-model'
import type { Builder } from './useBuilder'

/** "Knives", "Rarity · Uncommon" — what opened a column, as people say it. */
function parentLabelOf(columns: Column[], i: number): string | null {
  const p = columns[i]?.parent
  if (!p) return null
  const prev = columns[i - 1]?.field
  return prev?.options.find((o) => o.value === p.value)?.label ?? p.value
}

/**
 * Desktop: every open column side by side (Finder), each scrolling on its
 * own; the strip scrolls sideways to keep the newest column in view.
 * Phone: one column at a time, sliding in, with a back arrow — like the
 * iPhone Settings app. The breadcrumb names the path on both.
 */
export function FinderView({ builder, onSettings }: { builder: Builder; onSettings: (fieldId: string) => void }) {
  const { columns } = builder
  const strip = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const depth = columns.length - 1

  useEffect(() => {
    strip.current?.scrollTo({ left: strip.current.scrollWidth, behavior: reduce ? 'auto' : 'smooth' })
  }, [columns.length, reduce])

  const crumbs = columns.flatMap((c, i) => {
    const out: string[] = []
    if (c.field) out.push(c.field.name)
    if (c.value != null && i < depth) out.push(c.field?.options.find((o) => o.value === c.value)?.label ?? c.value)
    return out
  })

  return (
    <div className="space-y-3">
      <nav aria-label="Path" className="flex min-h-[28px] flex-wrap items-center gap-1 text-[13px] text-text-tertiary">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <CaretRight aria-hidden weight="bold" className="h-3 w-3" />}
            <span className={i === crumbs.length - 1 ? 'font-medium text-text-primary' : undefined}>{c}</span>
          </span>
        ))}
      </nav>

      {/* Desktop columns */}
      <div
        ref={strip}
        className="hidden h-[calc(100dvh-260px)] min-h-[520px] gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex"
      >
        {columns.map((c, i) => (
          <FieldColumn
            key={`${i}:${c.parent?.fieldId ?? 'top'}:${c.parent?.value ?? ''}`}
            column={c}
            index={i}
            builder={builder}
            parentLabel={parentLabelOf(columns, i)}
            onSettings={onSettings}
          />
        ))}
        {/* Nothing picked in the last column yet: a quiet hint where the next
            column will open, so the strip never reads as one lone column. */}
        {columns[depth]?.field && columns[depth].value == null && (columns[depth].field?.options.length ?? 0) > 0 && (
          <div className="flex w-[300px] shrink-0 items-center justify-center rounded-[10px] border border-dashed border-white/[0.07] px-8 text-center text-[13px] leading-relaxed text-text-tertiary">
            Pick a {columns[depth].field!.name} choice to set what sellers fill in after it.
          </div>
        )}
      </div>

      {/* Phone: one column */}
      <div className="lg:hidden">
        {depth > 0 && (
          <button
            type="button"
            onClick={builder.back}
            className="mb-2 inline-flex h-10 items-center gap-1 rounded-md pr-3 text-[14px] font-medium text-text-secondary hover:text-text-primary"
          >
            <CaretLeft aria-hidden weight="bold" className="h-4 w-4" />
            {columns[depth - 1]?.field?.name ?? 'Back'}
          </button>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={depth}
            initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: -40, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="h-[calc(100dvh-230px)] min-h-[440px]"
          >
            <FieldColumn
              column={columns[depth]}
              index={depth}
              builder={builder}
              parentLabel={parentLabelOf(columns, depth)}
              onSettings={onSettings}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
