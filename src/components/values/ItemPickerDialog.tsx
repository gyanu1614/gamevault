'use client'

import { useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import { ValueArt } from './ValueArt'
import { ValueSearchField } from './ValueSearchField'
import { RarityFilterBar, type RarityFilterOption } from './RarityFilterBar'

export interface ItemPickerItem {
  key: string
  name: string
  imageUrl: string | null
  /** Small line under the name (rarity, income…). */
  sub?: string
  /** Colour for the sub line (e.g. the rarity colour); tertiary text otherwise. */
  subColor?: string
}

/**
 * The ONE item-picker modal for every values calculator (SAB WFL editor,
 * Adopt Me WFL + Neon pickers). Built on ui/dialog: centred panel on desktop,
 * bottom sheet on phones, closes on Escape / outside tap, focus is trapped
 * while open and handed back on close.
 *
 * Step 1 is search (+ optional rarity filter) over a grid of item art. A
 * caller with a second step (pick a mutation / variant, edit an entry)
 * passes `detail`, which replaces the grid; `onBack` adds a back arrow.
 * Search and filter state are CONTROLLED so each calculator keeps its own
 * matching / ordering logic; the dialog only renders `items` as given.
 * Enter in the search box picks the first result.
 */
export function ItemPickerDialog({
  open,
  onClose,
  title,
  subtitle,
  items,
  onPick,
  query,
  onQueryChange,
  searchPlaceholder,
  searchLabel,
  rarityOptions,
  rarity,
  onRarityChange,
  emptyText = 'No items match.',
  pixelated = false,
  detail,
  onBack,
  backLabel = 'Back',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  items: ItemPickerItem[]
  onPick: (key: string) => void
  query: string
  onQueryChange: (q: string) => void
  searchPlaceholder: string
  searchLabel: string
  rarityOptions?: RarityFilterOption[]
  rarity?: string
  onRarityChange?: (key: string) => void
  emptyText?: string
  pixelated?: boolean
  /** Second step content; replaces search + grid while set. */
  detail?: ReactNode
  /** Shows a back arrow in the header while `detail` is set. */
  onBack?: () => void
  backLabel?: string
}) {
  // Phones: don't pop the keyboard over the grid on open (useCoarsePointer).
  const coarse = useCoarsePointer()
  const reduced = useReducedMotion()
  const searchWrap = useRef<HTMLDivElement>(null)
  // While the close animation plays, keep showing what was on screen (callers
  // usually clear their step state in the same tick they close).
  const live = { title, subtitle, items, detail, onBack }
  const shown = useRef(live)
  if (open) shown.current = live
  const view = open ? live : shown.current
  const inDetail = view.detail != null

  const fade = reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
      }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // Desktop: focus the search so typing filters at once. Phones: focus
          // nothing (Radix would otherwise focus the first control).
          e.preventDefault()
          if (!coarse && !inDetail) searchWrap.current?.querySelector('input')?.focus()
        }}
        className={`flex flex-col gap-0 overflow-hidden border-0 bg-bg-raised p-0 ${
          inDetail ? 'max-h-[calc(100dvh-2rem)] sm:max-w-lg' : 'h-[85dvh] sm:h-[min(760px,85vh)] sm:max-w-3xl'
        }`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] py-3.5 pl-4 pr-14 sm:pl-5">
          {inDetail && view.onBack && (
            <button
              type="button"
              onClick={view.onBack}
              aria-label={backLabel}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ArrowLeftIcon size={18} weight="bold" aria-hidden />
            </button>
          )}
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight text-text-primary">{view.title}</DialogTitle>
            {view.subtitle ? (
              <DialogDescription className="mt-1 text-[12px] text-text-tertiary">{view.subtitle}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{view.title}</DialogDescription>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {inDetail ? (
            <motion.div key="detail" {...fade} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {view.detail}
            </motion.div>
          ) : (
            <motion.div key="grid" {...fade} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 space-y-2 px-4 pt-4 sm:px-5" ref={searchWrap}>
                <div
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && view.items[0]) {
                      e.preventDefault()
                      onPick(view.items[0].key)
                    }
                  }}
                >
                  <ValueSearchField
                    value={query}
                    onChange={onQueryChange}
                    placeholder={searchPlaceholder}
                    label={searchLabel}
                  />
                </div>
                {rarityOptions && rarityOptions.length > 1 && onRarityChange && (
                  <RarityFilterBar options={rarityOptions} value={rarity ?? ''} onChange={onRarityChange} />
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {view.items.length === 0 ? (
                  <p className="flex h-full min-h-[160px] items-center justify-center text-center text-body-sm text-text-tertiary">
                    {emptyText}
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {view.items.map((it) => (
                      <li key={it.key}>
                        <button
                          type="button"
                          onClick={() => onPick(it.key)}
                          className="group flex h-full w-full flex-col items-center gap-1.5 rounded-md bg-white/[0.04] p-2.5 text-center transition-[background-color,transform] hover:bg-white/[0.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <ValueArt
                            src={it.imageUrl}
                            alt=""
                            size={64}
                            pixelated={pixelated}
                            className="transition-transform duration-200 group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          />
                          <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-text-primary">
                            {it.name}
                          </span>
                          {it.sub && (
                            <span
                              className="truncate text-[11px] font-medium text-text-tertiary"
                              style={it.subColor ? { color: it.subColor } : undefined}
                            >
                              {it.sub}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
