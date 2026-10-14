'use client'

/**
 * The hub nav's Codes menu (Blog v2, 2026-10-13 — like Eldorado's "Codes ▾"):
 * every game with a codes page, each opening its one /{game}/codes page. Only
 * switched-on games that have one are listed (hub-games.ts codesMenuGames),
 * so the menu grows by itself as games get codes posts — no per-game wiring.
 *
 * Radix Popover (portalled, collision-aware, non-modal): outside tap, Escape
 * or picking a game closes it. Styled as one of the nav's tabs.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CodesMenuGame } from '@/lib/content/hub-games'
import { GameMark } from './GameMark'

export function HubCodesMenu({ games, variant }: { games: CodesMenuGame[]; variant: 'desktop' | 'mobile' }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ''
  if (games.length === 0) return null
  const onCodes = games.some((g) => pathname === g.href)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
          variant === 'desktop' ? 'h-full text-[15px]' : 'py-2.5 text-[14px]'
        } ${onCodes || open ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
      >
        Codes
        <CaretDownIcon size={13} weight="bold" aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        {onCodes && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-text-primary" />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={variant === 'desktop' ? 1 : 4}
        className="w-[260px] max-w-[calc(100vw-24px)] rounded-lg border-0 bg-[rgba(29,30,35,0.97)] p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
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
