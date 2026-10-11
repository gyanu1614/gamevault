'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type GlobalCategory } from '@/lib/actions/new-schema'
import { CATEGORY_THEME, categoryGlyphStyle } from '@/app/(sell)/_components/sell-wizard/steps/category-theme'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'

export function Step1Category({
  categories, selected, onSelect,
}: {
  categories: GlobalCategory[]
  selected: GlobalCategory | null
  onSelect: (c: GlobalCategory) => void
}) {
  // R14 — Balanced flex-wrap layout: each tile takes a fixed share of the row
  // (~half on mobile, ~third on lg) and the last row centers any orphan cards
  // so the 5-category set reads as 2-2-1 (centered) instead of an
  // off-balance 3-2 grid.
  return (
    // 2x2 on desktop, single column on a phone. CSS Grid rather than
    // flex-wrap so the cells are equal width and the row count is
    // explicit (see 3.E: grid over flex-math).
    <SubCard>
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      {categories.map((c, i) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        const theme = CATEGORY_THEME[c.slug] ?? CATEGORY_THEME.items
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            // R17 — entry animation dropped on first paint. The page is
            // server-rendered; staggered fade-in made the tiles feel "loaded
            // later" than the navbar.
            initial={false}

            className={cn(
              // A 2-col grid cell (the parent owns the columns now). The
              // old 3-per-row flex basis left the 4th category orphaned
              // on its own row; with 4 fixed categories a 2x2 grid fills
              // exactly, with no stray cell.
              // Inside the card now, so translucent rather than a second
              // solid surface (a card inside a card), rectangular like the
              // other controls, and colour-only on hover (no lift).
              'group relative flex items-center gap-3 overflow-hidden rounded-md border p-3 text-left transition-colors',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-lime bg-lime-tint-bg'
                : cn('border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06]', theme.ring),
            )}
          >
            {/* Icon plate — smaller than the previous tile design */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-default sm:h-11 sm:w-11',
                theme.iconBg,
              )}
            >
              <span
                aria-hidden
                style={categoryGlyphStyle(theme.icon)}
                className="block h-5 w-5 bg-text-primary sm:h-6 sm:w-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-text-primary sm:text-base">{c.name}</span>
                {disabled && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-warning bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
                    Soon
                  </span>
                )}
              </div>
              {/* R15 — concrete examples (see CATEGORY_THEME.example) replace
                  the DB description. Brighter color + no truncation so the
                  helper text is always readable. */}
              <div className="mt-0.5 truncate text-xs text-text-secondary sm:text-[13px]">
                {theme.example}
              </div>
            </div>

            {/* Trailing indicator */}
            {!disabled && (
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-lime text-text-inverse'
                    : 'text-text-tertiary group-hover:text-text-primary',
                )}
              >
                {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ArrowRight className="h-3.5 w-3.5" />}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
    </SubCard>
  )
}
