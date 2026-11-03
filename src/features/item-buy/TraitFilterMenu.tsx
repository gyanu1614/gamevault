'use client'

import { useId } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { LucideIcon } from 'lucide-react'
import { FILTER_LIST, FILTER_ROW, FILTER_TICK, FilterPanel, FilterTrigger, useFilterDropdown } from '@/components/marketplace/FilterDropdown'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import type { AmLetter } from './model/am-traits'

/** The filter letters in the picker's order, each in its badge's colour (also the items grid's phone filter sheet). */
export const TRAIT_LETTERS: Array<{ letter: AmLetter; label: string; color: string }> = [
  { letter: 'N', label: 'Neon', color: '#8DC54A' },
  { letter: 'M', label: 'Mega Neon', color: '#A970FF' },
  { letter: 'F', label: 'Fly', color: '#3298CB' },
  { letter: 'R', label: 'Ride', color: '#EA2E77' },
]

/**
 * The trait filter (owner, 2026-11-02, Eldorado's "Traits" menu as the
 * reference, in our design): each row is a tick box, the game's own badge and
 * its name; the panel stays open while you tick. The button shows the ticked
 * badges. What the ticks mean is the page's: one form on a pet's offers
 * (model/am-traits), every form with those letters on the Items page. The
 * shared FilterDropdown, so it matches the filters beside it.
 */
export function TraitFilterMenu({
  lit,
  onToggle,
  onClear,
  icon,
}: {
  lit: ReadonlySet<AmLetter>
  onToggle: (letter: AmLetter) => void
  onClear: () => void
  icon?: LucideIcon
}) {
  const { open, setOpen, triggerRef, alignOffset } = useFilterDropdown('start')
  const baseId = useId()
  const picked = TRAIT_LETTERS.filter((l) => lit.has(l.letter))
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <FilterTrigger
        icon={icon}
        segment={false}
        active={picked.length > 0}
        open={open}
        buttonRef={triggerRef}
        label={
          picked.length > 0 ? (
            <span className="flex items-center gap-2">
              Traits
              <span className="flex items-center gap-1">
                {picked.map((l) => (
                  <TraitMarks key={l.letter} code={l.letter} size={18} />
                ))}
              </span>
            </span>
          ) : (
            'Choose Traits'
          )
        }
      />
      <FilterPanel title="Traits" alignOffset={alignOffset} onClear={picked.length > 0 ? onClear : undefined}>
        <ul className={FILTER_LIST} aria-label="Trait options">
          {TRAIT_LETTERS.map((l) => {
            const on = lit.has(l.letter)
            const id = `${baseId}-${l.letter}`
            return (
              <li key={l.letter}>
                <label htmlFor={id} className={cn(FILTER_ROW, on ? 'text-text-primary' : 'text-text-secondary')}>
                  <Checkbox
                    id={id}
                    checked={on}
                    onCheckedChange={() => onToggle(l.letter)}
                    className={FILTER_TICK}
                    style={on ? { background: l.color, borderColor: l.color } : undefined}
                  />
                  <TraitMarks code={l.letter} size={20} />
                  <span className="min-w-0 truncate">{l.label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </FilterPanel>
    </Popover.Root>
  )
}
