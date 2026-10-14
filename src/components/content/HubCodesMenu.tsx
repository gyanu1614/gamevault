'use client'

/**
 * The hub nav's Codes button (Blog v2, 2026-10-13 — like Eldorado's "Codes ▾"):
 * every game with a codes page, each opening its one /{game}/codes page. Only
 * switched-on games that have one are listed (hub-games.ts codesMenuGames),
 * so the menu grows by itself as games get codes posts — no per-game wiring.
 *
 * Its own button beside the game switcher, in the switcher's pill style
 * (owner: "next to the game switcher, a separate button", not a tab):
 *  - `bar`: in the top row, md+; the panel hangs off the bar's bottom edge
 *    like the switcher's.
 *  - `row`: phones (below md) have no room in the top row, so a compact pill
 *    leads the tab sub-row, straight under the switcher.
 *
 * Radix Popover (portalled, collision-aware, non-modal): outside tap, Escape
 * or picking a game closes it.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { TicketIcon } from '@phosphor-icons/react/dist/csr/Ticket'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CodesMenuGame } from '@/lib/content/hub-games'
import { GameMark } from './GameMark'

const PILL = 'group flex shrink-0 touch-manipulation items-center border font-semibold text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
const PILL_IDLE = 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.07]'
const PILL_ON = 'border-white/[0.14] bg-white/[0.08]'
const SIZE = {
  bar: 'h-10 gap-2 rounded-[10px] pl-2.5 pr-2 text-[15px] sm:h-11 sm:text-[16px]',
  row: 'my-1 h-8 gap-1.5 rounded-[8px] pl-2 pr-1.5 text-[13px]',
} as const

export function HubCodesMenu({ games, variant }: { games: CodesMenuGame[]; variant: 'bar' | 'row' }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ''
  if (games.length === 0) return null
  const onCodes = games.some((g) => pathname === g.href)
  const bar = variant === 'bar'

  const trigger = (
    <PopoverTrigger aria-label="Codes by game" className={`${PILL} ${SIZE[variant]} ${open || onCodes ? PILL_ON : PILL_IDLE}`}>
      <TicketIcon aria-hidden size={bar ? 18 : 15} weight="bold" className="text-text-secondary transition-colors group-hover:text-text-primary" />
      Codes
      <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary transition-colors group-hover:text-text-primary ${bar ? 'h-6 w-6' : 'h-5 w-5'}`}>
        <CaretDownIcon size={bar ? 14 : 12} weight="bold" className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </span>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {bar ? (
        // The anchor spans the bar's height, so the panel continues the bar (as the switcher's does).
        <PopoverAnchor asChild>
          <div className="hidden shrink-0 items-center self-stretch md:flex">{trigger}</div>
        </PopoverAnchor>
      ) : (
        <div className="flex shrink-0 items-center md:hidden">{trigger}</div>
      )}
      <PopoverContent
        align="start"
        sideOffset={bar ? 1 : 4}
        className={`w-[260px] max-w-[calc(100vw-24px)] border-0 bg-[rgba(29,30,35,0.97)] p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] backdrop-blur-2xl ${
          bar ? 'rounded-b-lg rounded-t-none' : 'rounded-lg'
        }`}
      >
        <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-text-tertiary">Codes by Game</p>
        <ul>
          {games.map((g) => {
            const active = pathname === g.href
            return (
              <li key={g.slug}>
                <Link
                  href={g.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-md px-2.5 py-2.5 text-[15px] transition-colors hover:bg-white/[0.06] hover:text-text-primary ${
                    active ? 'bg-white/[0.06] font-semibold text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  <GameMark name={g.name} imageUrl={g.imageUrl} size="row" />
                  <span className="min-w-0 flex-1 truncate">{g.name} Codes</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
