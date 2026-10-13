'use client'

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import Link from '@/components/navigation/AppLink'
import type { SelectorGroup, SelectorOption } from '@/lib/values/variant-selector'
import { cn } from '@/lib/utils'

/**
 * The ONE variant selector (owner, 2026-10-11: "universal, every game"): each
 * group is a row of separate chips (no tray — 2026-10-12), and the active
 * option is a pill in that option's own colour that slides between chips
 * (Framer layout animation). The groups come
 * from data (lib/values/variant-selector): Adopt Me tier + potion, SAB
 * mutations, MM2 forms — so every hero, list card and calculator reads the
 * same and a new mutation needs no UI change.
 *
 *   single  a radio group: arrow keys move the pick; the pill slides.
 *   toggle  each option on/off (Fly, Ride): the on ones carry the same pill.
 *   many    a long single group (SAB's 14 mutations) becomes a swipeable
 *           strip with faded edges; the pick scrolls into view.
 *
 * Clicks never bubble: list cards are links, picking a variant must not open
 * the item page. Reduced motion: the pill jumps instead of sliding.
 */
const MANY = 6

const hasHint = (g: SelectorGroup) => g.options.some((o) => !!o.hint)
const SPRING = { type: 'spring' as const, bounce: 0, duration: 0.32 }

export function VariantSelector({
  groups,
  onSelect,
  accent,
  size = 'md',
  labels = true,
  direction = 'row',
  merged = false,
  fill = false,
  className,
}: {
  groups: SelectorGroup[]
  onSelect: (groupId: string, key: string) => void
  /** Active colour when an option has none of its own (Adopt Me: the variant colour). */
  accent?: string
  size?: 'md' | 'sm'
  /** Show each group's label ("Tier", "Potion") above its track. */
  labels?: boolean
  /** column: a vertical list (the list cards' mutation popover); the pill slides down. */
  direction?: 'row' | 'column'
  /** All groups in ONE tray, split by a hairline (the item hero: Default | Neon | Mega ‖ Fly | Ride). */
  merged?: boolean
  /** Each tray takes the full width and its options share it evenly (under the hero art). */
  fill?: boolean
  className?: string
}) {
  const id = useId()
  if (merged) {
    return (
      <LayoutGroup id={id}>
        <div className={cn('inline-flex max-w-full flex-wrap items-center gap-2', className)}>
          {groups.map((g, i) => (
            <div key={g.id} className="contents">
              {i > 0 && <span aria-hidden className="mx-0.5 h-5 w-px bg-white/[0.1]" />}
              <Group group={g} onSelect={onSelect} accent={accent} size={size} label={false} column={false} bare />
            </div>
          ))}
        </div>
      </LayoutGroup>
    )
  }
  return (
    <LayoutGroup id={id}>
      <div className={cn('flex flex-wrap items-end gap-x-3 gap-y-3', className)}>
        {groups.map((g) => (
          <Group key={g.id} group={g} onSelect={onSelect} accent={accent} size={size} label={labels} column={direction === 'column'} fill={fill} />
        ))}
      </div>
    </LayoutGroup>
  )
}

function Group({
  group,
  onSelect,
  accent,
  size,
  label,
  column,
  bare = false,
  fill = false,
}: {
  group: SelectorGroup
  onSelect: (groupId: string, key: string) => void
  accent?: string
  size: 'md' | 'sm'
  label: boolean
  column: boolean
  /** Inside a merged tray: the options only, no own tray. */
  bare?: boolean
  fill?: boolean
}) {
  const reduce = useReducedMotion()
  const track = useRef<HTMLDivElement | null>(null)
  const many = !column && !bare && group.mode === 'single' && group.options.length > MANY
  const activeKey = group.options.find((o) => o.active)?.key

  // Keep the pick in view on a swipeable strip (and after a pick elsewhere).
  useEffect(() => {
    if ((!many && !column) || !track.current || !activeKey) return
    const el = track.current.querySelector<HTMLElement>(`[data-key="${CSS.escape(activeKey)}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [many, column, activeKey, reduce])

  const pick = (o: SelectorOption) => (e: MouseEvent) => {
    e.stopPropagation()
    if (o.href) return
    e.preventDefault()
    if (!o.disabled) onSelect(group.id, o.key)
  }

  // Radio-group keys: ←/→ (and ↑/↓) move the pick, skipping disabled options.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (group.mode !== 'single') return
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const enabled = group.options.filter((o) => !o.disabled && !o.href)
    const at = enabled.findIndex((o) => o.active)
    const next = enabled[(at + dir + enabled.length) % enabled.length]
    if (!next) return
    onSelect(group.id, next.key)
    track.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"]`)?.focus()
  }

  // One fixed height per size, so every option (and every tray) lines up.
  const h = size === 'sm' ? 'h-8 px-3 text-[13px]' : hasHint(group) ? 'min-h-10 px-3.5 py-1.5 text-body-sm' : 'h-10 px-3.5 text-body-sm'

  return (
    <div className={cn(bare ? 'contents' : 'min-w-0', (many || column || fill) && 'w-full', column && 'flex min-h-0 flex-1 flex-col')}>
      {label && <p className="mb-1.5 text-caption font-medium text-[#9A9DA6]">{group.label}</p>}
      <div
        ref={track}
        role={group.mode === 'single' ? 'radiogroup' : 'group'}
        aria-label={group.label}
        onKeyDown={onKeyDown}
        className={cn(
          // No tray (owner, 2026-10-12: a dark box with a filled pill inside read
          // as a box in a box): the options are separate chips on the card.
          'relative flex gap-2',
          bare
            ? ''
            : column
            ? 'min-h-0 w-full flex-1 flex-col overflow-y-auto [scrollbar-width:thin]'
            : many
            ? 'w-full snap-x overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : fill ? 'w-full' : 'w-fit max-w-full',
        )}
      >
        {group.options.map((o) => {
          const color = o.color ?? accent ?? '#E9EDF2'
          const isRadio = group.mode === 'single'
          const tabIndex = isRadio ? (o.active || (!activeKey && o === group.options[0]) ? 0 : -1) : 0
          const inner = (
            <>
              {o.active && (
                <motion.span
                  aria-hidden
                  layoutId={isRadio ? `pill-${group.id}` : undefined}
                  transition={reduce ? { duration: 0 } : SPRING}
                  className="absolute inset-0 rounded-[8px] border"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 22%, #1D1E23)`,
                    borderColor: `color-mix(in srgb, ${color} 65%, transparent)`,
                  }}
                />
              )}
              <span className="relative flex items-center gap-1.5 whitespace-nowrap">
                {o.color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
                <span className="flex flex-col items-start leading-tight">
                  <span>{o.label}</span>
                  {o.hint && (
                    <span className={cn('text-[11px] font-medium tabular-nums', o.active ? '' : 'text-[#7C7F88]')} style={o.active ? { color } : undefined}>
                      {o.hint}
                    </span>
                  )}
                </span>
              </span>
            </>
          )
          const cls = cn(
            'relative shrink-0 touch-manipulation snap-start rounded-[8px] border border-white/[0.08] bg-white/[0.03] font-semibold transition-colors duration-150',
            column && 'w-full text-left',
            fill && !many && 'inline-flex min-w-0 flex-1 items-center justify-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            h,
            // Even trays share the width; tighter padding so three tiers fit.
            fill && !many && 'px-2',
            o.active ? 'border-transparent text-white' : 'text-[#B4B7BF] hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white',
            o.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-[#9A9DA6]',
          )
          return o.href ? (
            <Link
              key={o.key}
              data-key={o.key}
              href={o.href}
              onClick={pick(o)}
              aria-current={o.active ? 'page' : undefined}
              className={cls}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={o.key}
              data-key={o.key}
              type="button"
              role={isRadio ? 'radio' : undefined}
              aria-checked={isRadio ? o.active : undefined}
              aria-pressed={isRadio ? undefined : o.active}
              tabIndex={tabIndex}
              disabled={o.disabled}
              onClick={pick(o)}
              className={cls}
            >
              {inner}
            </button>
          )
        })}
      </div>
    </div>
  )
}
