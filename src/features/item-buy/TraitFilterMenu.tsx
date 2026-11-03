'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import type { AmLetter } from './model/am-traits'

/** The filter letters in the picker's order, each in its badge's colour. */
const LETTERS: Array<{ letter: AmLetter; label: string; color: string }> = [
  { letter: 'N', label: 'Neon', color: '#8DC54A' },
  { letter: 'M', label: 'Mega Neon', color: '#A970FF' },
  { letter: 'F', label: 'Fly', color: '#3298CB' },
  { letter: 'R', label: 'Ride', color: '#EA2E77' },
]

/**
 * The offers' trait filter as one dropdown (owner, 2026-11-02, Eldorado's
 * "Traits" menu as the reference, in our design): each row is a tick box,
 * the game's own badge and its name; the menu stays open while you tick. The
 * trigger shows the ticked badges. The letters still land on one form
 * (model/am-traits: N and M exclude each other).
 */
export function TraitFilterMenu({
  lit,
  onToggle,
  onClear,
}: {
  lit: ReadonlySet<AmLetter>
  onToggle: (letter: AmLetter) => void
  onClear: () => void
}) {
  const picked = LETTERS.filter((l) => lit.has(l.letter))
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className={cn(
          'flex h-10 items-center gap-2 rounded-md bg-white/[0.05] pl-3.5 pr-2.5 font-semibold text-text-primary transition-colors hover:bg-white/[0.08]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=open]:bg-white/[0.08]',
        )}
        style={{ fontSize: 'var(--fs-body)' }}
      >
        {picked.length > 0 ? 'Traits' : 'Choose Traits'}
        {picked.length > 0 ? (
          <span className="flex items-center gap-1">
            {picked.map((l) => (
              <TraitMarks key={l.letter} code={l.letter} size={18} />
            ))}
          </span>
        ) : null}
        <IconChevronDown aria-hidden size={16} stroke={2} className="text-text-tertiary transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 min-w-[220px] rounded-lg bg-[#1D1E23] p-1.5',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-16px_rgba(0,0,0,0.8)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1',
          )}
        >
          {LETTERS.map((l) => {
            const on = lit.has(l.letter)
            return (
              <DropdownMenu.CheckboxItem
                key={l.letter}
                checked={on}
                onCheckedChange={() => onToggle(l.letter)}
                onSelect={(e) => e.preventDefault()}
                className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-md px-2.5 text-text-primary outline-none transition-colors data-[highlighted]:bg-white/[0.06]"
                style={{ fontSize: 'var(--fs-body)' }}
              >
                <span
                  aria-hidden
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded transition-colors"
                  style={on ? { background: l.color } : { boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.28)' }}
                >
                  {on ? <IconCheck size={13} stroke={3} className="text-[#141519]" /> : null}
                </span>
                <TraitMarks code={l.letter} size={20} />
                <span className={cn('font-medium', !on && 'text-text-secondary')}>{l.label}</span>
              </DropdownMenu.CheckboxItem>
            )
          })}
          {picked.length > 0 ? (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-white/[0.07]" />
              <DropdownMenu.Item
                onSelect={onClear}
                className="flex h-10 cursor-pointer select-none items-center rounded-md px-2.5 font-semibold text-text-secondary outline-none transition-colors data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-text-primary"
                style={{ fontSize: 'var(--fs-meta)' }}
              >
                Show All Traits
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
