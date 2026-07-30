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

  const { current, games, tools, itemsHref, accountsHref } = data

  return (
    // Always solid — no transparent state at the top of the page.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1E2723] bg-[#0C0F0E]">
      {/* Full-bleed row: no max-width cap, so the brand sits at the true left
          edge of the page and the storefront buttons at the true right edge.
          Only the page gutter insets them. The tab group stays centred on the
          PAGE because the two side groups are each `flex-1` at md+ — equal
          basis means the middle lands dead centre regardless of how wide the
          game name or buttons are. HUB_NAV_H is the single source of truth for
          the height; pages clear it via HUB_NAV_CLEAR. */}
      <div className="flex h-[64px] w-full items-center gap-2.5 px-4 sm:h-[76px] sm:gap-4 sm:px-6 lg:px-10">
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
            <span className="hidden whitespace-nowrap text-[16px] font-semibold text-[#F1F3F1] md:inline">
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
                    href={`/${g.slug}/blogs`}
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

        {/* ── Section tabs, centred: Guides (home) + data-driven tools ──
            Below md the row must stay shrinkable and scrollable — brand + tabs
            + Buy items are wider than a phone, and this is the element that
            gives. From md up it takes its natural width and the flex-1 side
            groups centre it on the page. */}
        {/* justify-start below md, NOT center: when this row overflows,
            centering clips BOTH ends and leaves the first tab unreachable
            ("ides" instead of "Guides"). Left-aligned, the first tab is always
            whole and the rest scroll into view. At md+ it no longer overflows
            and the flex-1 side groups do the centring. */}
        <nav className="flex min-w-0 flex-1 items-center justify-start gap-4 self-stretch overflow-x-auto sm:gap-7 md:flex-none md:justify-center md:gap-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'guides', label: 'Guides', href: `/${current.slug}/blogs` },
            // The calculator's two modes are their own tabs rather than a
            // dropdown: two options never justified a menu, and flat tabs are
            // one tap instead of two — plus both are crawlable links.
            ...tools.flatMap((tool) =>
              tool === 'calculator'
                ? [
                    {
                      key: 'calculator',
                      label: 'WFL Calculator',
                      href: `/${current.slug}/calculator`,
                    },
                    {
                      key: 'cash',
                      label: 'Cash Price',
                      href: `/${current.slug}/calculator?tab=cash`,
                    },
                  ]
                : [
                    {
                      key: tool,
                      label: TOOL_LABEL[tool],
                      href: `/${current.slug}/${tool}`,
                    },
                  ],
            ),
          ].map((tab) => {
            // ?tab=cash and the bare calculator URL share a pathname, so the
            // active tab is decided by the query too — otherwise both light up.
            const onCalculator = pathname.startsWith(`/${current.slug}/calculator`)
            const active =
              tab.key === 'calculator'
                ? onCalculator && calcMode !== 'cash'
                : tab.key === 'cash'
                  ? onCalculator && calcMode === 'cash'
                  : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.key}
                href={tab.href}
                // h-full so the active underline sits on the bar's bottom edge
                // rather than hugging the text.
                className={`relative flex h-full shrink-0 items-center whitespace-nowrap text-[14px] font-semibold transition sm:text-[15px] ${
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

        {/* ── Storefront buttons (data-driven) — pinned to the right edge ── */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 md:flex-1">
          {itemsHref && (
            <Link
              href={itemsHref}
              className="flex items-center gap-1.5 whitespace-nowrap bg-[#3FA35C] px-3 py-2.5 text-[13px] font-semibold text-[#08110B] transition hover:bg-[#4CBB6B] sm:px-4 sm:py-3 sm:text-[14px]"
            >
              Buy items
              {/* Option A — the arrow nudges right every few seconds. */}
              <span className="hidden animate-arrow-nudge motion-reduce:animate-none sm:inline-block">
                <NorthEastIcon sx={{ fontSize: 14 }} />
              </span>
            </Link>
          )}
          {accountsHref && (
            <Link
              href={accountsHref}
              className="hidden items-center gap-1.5 whitespace-nowrap border border-[#2F6B46] px-4 py-3 text-[14px] font-semibold transition hover:border-[#3FA35C] md:flex"
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
