'use client'

/**
 * Shared content-hub navbar — one row, identical structure for every game.
 *
 *   [game icon + name ▾]        [Values] [Calculator]       [Buy items][Accounts]
 *
 * - The game name opens the game switcher; picking a game goes to ITS hub
 *   home (/{slug}/blogs). The current game's row also returns to hub home,
 *   so the name doubles as the "Blog/home" link — no separate Blog tab.
 * - Tool tabs and buy buttons are data-driven; games without a category or
 *   tool simply don't render that control.
 * - Rectangular everywhere, forest palette, fixed with scroll fill like the
 *   old ValuesHeader.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import type { HubNavData } from '@/lib/content/hubNav'

const TOOL_LABEL: Record<'values' | 'calculator', string> = {
  values: 'Values',
  calculator: 'Calculator',
}

export function HubNav({ data }: { data: HubNavData }) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Outside-tap closes the switcher (mobile-friendly, per house rules).
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  const { current, games, tools, itemsHref, accountsHref } = data

  return (
    // Always solid — no transparent state at the top of the page.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1E2723] bg-[#0C0F0E]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* ── Brand mark + game switcher ── */}
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/" aria-label="DropMarket home" className="shrink-0">
            <Image
              src="/brand/logo-mark-white.png"
              alt="DropMarket"
              width={30}
              height={30}
              className="h-[30px] w-[30px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            />
          </Link>
          <span aria-hidden className="h-[22px] w-px bg-[#26332C]" />

        {/* ── Game switcher ── */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 py-3 text-left"
          >
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote game logo
              <img
                src={current.imageUrl}
                alt=""
                className="h-[30px] w-[30px] shrink-0 object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[10px] font-bold text-white"
              >
                {current.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="hidden whitespace-nowrap text-[15px] font-semibold text-[#F1F3F1] md:inline">
              {current.name}
            </span>
            <KeyboardArrowDownIcon
              sx={{ fontSize: 18 }}
              className={`text-[#8FBF9C] transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 max-h-[70vh] w-[260px] overflow-y-auto border border-[#26332C] bg-[#0E130F] shadow-2xl"
            >
              {games.map((g) => {
                const active = g.slug === current.slug
                return (
                  <Link
                    key={g.slug}
                    role="menuitem"
                    href={`/${g.slug}/blogs`}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] transition-colors ${
                      active
                        ? 'bg-[#12321F] font-semibold text-[#E7F4EC]'
                        : 'text-[#C6CEC9] hover:bg-white/[0.04]'
                    }`}
                  >
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.imageUrl}
                        alt=""
                        className="h-[22px] w-[22px] shrink-0 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[8px] font-bold text-white"
                      >
                        {g.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate">{g.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
        </div>

        {/* ── Section tabs, centered: Guides (home) + data-driven tools ── */}
        <nav className="flex flex-1 items-center justify-center gap-5 overflow-x-auto sm:gap-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'guides', label: 'Guides', href: `/${current.slug}/blogs` },
            ...tools.map((tool) => ({
              key: tool,
              label: TOOL_LABEL[tool],
              href: `/${current.slug}/${tool}`,
            })),
          ].map((tab) => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`relative shrink-0 whitespace-nowrap py-4 text-[14px] font-semibold transition ${
                  active
                    ? 'text-[#F1F3F1]'
                    : 'text-[#A6B2AA] hover:text-[#E4EAE2]'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[2.5px] bg-[#4FB477]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Storefront buttons (data-driven) ── */}
        <div className="flex shrink-0 items-center gap-2">
          {itemsHref && (
            <Link
              href={itemsHref}
              className="flex items-center gap-1.5 whitespace-nowrap bg-[#3FA35C] px-3.5 py-2.5 text-[13px] font-semibold text-[#08110B] transition hover:bg-[#4CBB6B]"
            >
              Buy items
              {/* Option A — the arrow nudges right every few seconds. */}
              <span className="animate-arrow-nudge motion-reduce:animate-none">
                <NorthEastIcon sx={{ fontSize: 13 }} />
              </span>
            </Link>
          )}
          {accountsHref && (
            <Link
              href={accountsHref}
              className="hidden items-center gap-1.5 whitespace-nowrap border border-[#2F6B46] px-3.5 py-2.5 text-[13px] font-semibold transition hover:border-[#3FA35C] md:flex"
            >
              {/* Flowing gradient text — the classic Buy Items effect. */}
              <span className="animate-text-flow bg-[linear-gradient(110deg,#7Cd39a_0%,#F1F3F1_35%,#4FB477_60%,#7Cd39a_100%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:text-[#8FBF9C]">
                Accounts
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
