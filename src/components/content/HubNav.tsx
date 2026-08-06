'use client'

/**
 * Shared content-hub navbar — one row, identical structure for every game.
 *
 *   [game icon + name ▾]        [Values] [Calculator]       [Buy items][Accounts]
 *
 * - The game name opens the game switcher; picking a game goes to ITS hub
 *   home (/{slug}/blog). The current game's row also returns to hub home,
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
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined'
import type { HubNavData } from '@/lib/content/hubNav'

const TOOL_LABEL: Record<'values' | 'calculator', string> = {
  values: 'Values',
  calculator: 'Calculator',
}

export function HubNav({
  data,
  calcMode,
}: {
  data: HubNavData
  /**
   * Which calculator mode is showing, when we're on the calculator page. Comes
   * from the page's own resolved searchParams rather than useSearchParams(),
   * which would drag every hub page into a Suspense boundary at build time.
   */
  calcMode?: 'cash' | 'trade'
}) {
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

  const { current, games, tools, itemsHref, accountsHref, sellHref } = data

  // The page tabs, built once and rendered in two places: the inline desktop
  // nav (md+) and the mobile sub-row (below md). One source avoids drift.
  const tabs: { key: string; label: string; href: string }[] = [
    { key: 'guides', label: 'Guides', href: `/${current.slug}/blog` },
    // The calculator's two modes are their own tabs rather than a dropdown: two
    // options never justified a menu, and flat tabs are one tap instead of two
    // — plus both are crawlable links.
    ...tools.flatMap((tool) =>
      tool === 'calculator'
        ? [
            {
              key: 'calculator',
              label: 'WFL Calculator',
              href: `/${current.slug}/calculator`,
            },
            // "Cash Price" is a SAB-only tab (its calculator has a ?tab=cash
            // mode). Adopt Me has no separate cash tab — its value list IS the
            // cash lookup — so it's omitted there.
            ...(current.slug === 'adopt-me'
              ? []
              : [
                  {
                    key: 'cash',
                    label: 'Cash Price',
                    href: `/${current.slug}/calculator?tab=cash`,
                  },
                ]),
          ]
        : [
            {
              key: tool,
              label: TOOL_LABEL[tool as 'values' | 'calculator'],
              href: `/${current.slug}/${tool}`,
            },
          ],
    ),
  ]

  const isTabActive = (tab: { key: string; href: string }) => {
    // ?tab=cash and the bare calculator URL share a pathname, so the active tab
    // is decided by the query too — otherwise both light up.
    const onCalculator = pathname.startsWith(`/${current.slug}/calculator`)
    return tab.key === 'calculator'
      ? onCalculator && calcMode !== 'cash'
      : tab.key === 'cash'
        ? onCalculator && calcMode === 'cash'
        : pathname.startsWith(tab.href)
  }

  return (
    // Always solid — no transparent state at the top of the page. A hair
    // lighter than the page base (#0C0F0E) so the bar reads as its own surface
    // rather than a black void.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1E2723] bg-[#121714]">
      {/* Full-bleed row: no max-width cap, so the brand sits at the true left
          edge of the page and the storefront buttons at the true right edge.
          Only the page gutter insets them. The tab group stays centred on the
          PAGE because the two side groups are each `flex-1` at md+ — equal
          basis means the middle lands dead centre regardless of how wide the
          game name or buttons are. HUB_NAV_H is the single source of truth for
          the height; pages clear it via HUB_NAV_CLEAR. */}
      <div className="flex h-[56px] w-full items-center gap-2.5 px-4 sm:h-[68px] sm:gap-4 sm:px-6 lg:px-10">
        {/* ── Brand mark + game switcher ──
            shrink-0 below md (the row is already tight on a phone), flex-1 from
            md up so it claims its half and centres the tabs. */}
        {/* self-stretch: the row is `items-center`, which would otherwise
            shrink-wrap this group to its 34px content height — and then the
            switcher's `h-full` trigger would only be 34px tall, leaving the
            menu floating mid-bar instead of hanging off the navbar's edge. */}
        <div className="flex shrink-0 items-center gap-2 self-stretch sm:gap-3 md:flex-1">
          <Link href="/" aria-label="DropMarket home" className="shrink-0">
            <Image
              src="/brand/logo-mark-white.png"
              alt="DropMarket"
              width={34}
              height={34}
              className="h-[28px] w-[28px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] sm:h-[34px] sm:w-[34px]"
            />
          </Link>
          <span aria-hidden className="hidden h-[26px] w-px bg-[#26332C] sm:block" />

        {/* ── Game switcher ──
            `self-stretch` + a full-height trigger is what makes the menu feel
            joined to the bar: `top-full` then resolves to the HEADER's bottom
            edge, not to the middle of the bar where a shorter button would end.
            Open state also paints the trigger in the menu's own colour, so the
            two read as one piece with the navbar's bottom line as the seam. */}
        {/* -ml-2.5 cancels the trigger's own padding, so adding a hit/hover
            area doesn't shift the game icon off its original alignment. */}
        <div ref={menuRef} className="relative -ml-2.5 shrink-0 self-stretch">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`flex h-full items-center gap-2.5 px-2.5 text-left transition-colors ${
              open ? 'bg-[#0E130F]' : 'hover:bg-white/[0.03]'
            }`}
          >
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote game logo
              <img
                src={current.imageUrl}
                alt=""
                className="h-[28px] w-[28px] shrink-0 object-cover sm:h-[34px] sm:w-[34px]"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[10px] font-bold text-white sm:h-[34px] sm:w-[34px] sm:text-[11px]"
              >
                {current.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            {/* Game name now shows on mobile too — the top/sub split frees the
                room the single row didn't have. Slightly smaller on phones. */}
            <span className="whitespace-nowrap text-[15px] font-semibold text-[#F1F3F1] sm:text-[16px]">
              {current.name}
            </span>
            <KeyboardArrowDownIcon
              sx={{ fontSize: 20 }}
              className={`text-[#8FBF9C] transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div
              role="menu"
              // border-t-0: the navbar's own bottom border IS this panel's top
              // edge, so no doubled hairline at the seam. Sized up to match the
              // taller bar, and slides down on open (existing `menu-down`).
              className="absolute left-0 top-full z-50 max-h-[min(70vh,520px)] w-[300px] animate-menu-down overflow-y-auto border border-t-0 border-[#26332C] bg-[#0E130F] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9)] motion-reduce:animate-none"
            >
              {games.map((g) => {
                const active = g.slug === current.slug
                return (
                  <Link
                    key={g.slug}
                    role="menuitem"
                    href={`/${g.slug}/blog`}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 px-4 py-3 text-[15px] transition-colors ${
                      active
                        ? 'bg-[#12321F] font-semibold text-[#E7F4EC]'
                        : 'text-[#C6CEC9] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Active row carries the same forest accent bar as the
                        navbar's active tab. */}
                    {active && (
                      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#4FB477]" />
                    )}
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.imageUrl}
                        alt=""
                        className="h-[26px] w-[26px] shrink-0 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[9px] font-bold text-white"
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

        {/* ── Section tabs — DESKTOP (md+) only ──
            Inline in the single row, centred on the page by the flex-1 side
            groups. On mobile these move to the sub-row below the top row. */}
        <nav className="hidden min-w-0 items-center justify-center gap-9 self-stretch md:flex md:flex-none">
          {tabs.map((tab) => {
            const active = isTabActive(tab)
            return (
              <Link
                key={tab.key}
                href={tab.href}
                // h-full so the active underline sits on the bar's bottom edge
                // rather than hugging the text.
                className={`relative flex h-full shrink-0 items-center whitespace-nowrap text-[15px] font-semibold transition ${
                  active ? 'text-[#F1F3F1]' : 'text-[#A6B2AA] hover:text-[#E4EAE2]'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#4FB477]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Storefront buttons — one SOLID BUY (green) + one SOLID SELL
            (amber), a clean pair separated by a divider. Data-driven per game.
            ml-auto pushes the pair to the right edge on mobile (where the middle
            nav is hidden); md:flex-1 takes over the centring role from md up. ── */}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2.5 md:ml-0 md:flex-1">
          {(() => {
            // Buy = items board when it exists, else the accounts board.
            const buyHref = itemsHref ?? accountsHref
            if (!buyHref) return null
            return (
              <Link
                href={buyHref}
                className="flex items-center gap-1.5 whitespace-nowrap bg-[#3FA35C] px-3 py-2.5 text-[13px] font-semibold text-[#08110B] transition hover:bg-[#4CBB6B] sm:px-4 sm:py-3 sm:text-[14px]"
              >
                {/* Bag icon on phones (matches the Sell pill's icon+text); the
                    nudging arrow takes over from sm up. */}
                <ShoppingBagOutlinedIcon sx={{ fontSize: 15 }} className="sm:hidden" />
                <span className="sm:hidden">Shop</span>
                <span className="hidden sm:inline">Shop {current.name}</span>
                <span className="hidden animate-arrow-nudge motion-reduce:animate-none sm:inline-block">
                  <NorthEastIcon sx={{ fontSize: 14 }} />
                </span>
              </Link>
            )
          })()}
          {/* Sell — solid amber + a divider set it apart from the buy button so
              it reads as its own action. Amber matches the founding-seller CTA. */}
          {sellHref && (
            <>
              <span aria-hidden className="hidden h-6 w-px bg-[#24352A] sm:block" />
              <Link
                href={sellHref}
                aria-label={`Sell ${current.name}`}
                className="flex items-center gap-1.5 whitespace-nowrap bg-[#F5C451] px-3 py-2.5 text-[13px] font-semibold text-[#141414] transition hover:bg-[#F8D477] sm:px-4 sm:py-3 sm:text-[14px]"
              >
                <SellOutlinedIcon sx={{ fontSize: 15 }} />
                Sell
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile sub-row: the page tabs (below md only) ──
          The desktop nav above is hidden under md; these move here so the top
          row stays uncluttered. Left-aligned + horizontally scrollable so a long
          set (Guides · Values · WFL Calculator · Cash Price) never clips the way
          the old single-row bar did. */}
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-[#1E2723] px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = isTabActive(tab)
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative flex shrink-0 items-center whitespace-nowrap py-2.5 text-[14px] font-semibold transition ${
                active ? 'text-[#F1F3F1]' : 'text-[#A6B2AA] hover:text-[#E4EAE2]'
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4FB477]" />
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
