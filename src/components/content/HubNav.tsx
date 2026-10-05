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
 * - Marketplace look (card-surface system): the same translucent near-black
 *   bar as the marketplace navbar, neutral tabs, and a searchable game
 *   switcher (Radix Popover + cmdk: type to filter ~235 games by name, arrow
 *   keys + Enter, Escape / outside-click close, no page trap).
 */

import { useState, useCallback, useRef } from 'react'
import Link from '@/components/navigation/AppLink'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/csr/ArrowUpRight'
import { ShoppingBagIcon } from '@phosphor-icons/react/dist/csr/ShoppingBag'
import { TagIcon } from '@phosphor-icons/react/dist/csr/Tag'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import { VALUE_BTN_PRIMARY, VALUE_PANEL } from '@/components/values/styles'
import type { HubNavData } from '@/lib/content/hubNav'

const TOOL_LABEL: Record<'values' | 'calculator', string> = {
  values: 'Values',
  calculator: 'Calculator',
}

/** Neutral tab colours (hub chrome stays neutral; no forest/lime accent). */
const TAB_ACTIVE = 'text-text-primary'
const TAB_IDLE = 'text-text-secondary hover:text-text-primary'

/**
 * Game search: case-insensitive name match (no fuzzy letter-skipping), name
 * starts first, then a word start, then anywhere. cmdk passes the name as the
 * item's only keyword (the value is the unique slug).
 */
function filterGames(value: string, search: string, keywords?: string[]): number {
  const q = search.trim().toLowerCase()
  if (!q) return 1
  const name = (keywords?.[0] ?? value).toLowerCase()
  if (name.startsWith(q)) return 1
  if (name.includes(` ${q}`)) return 0.8
  return name.includes(q) ? 0.6 : 0
}

export function HubNav({
  data,
  calcMode: calcModeOverride,
}: {
  data: HubNavData
  /**
   * Which calculator mode is showing, when we're on the calculator page.
   * Optional override (Adopt Me pins 'trade'); otherwise read from `?tab=` on
   * the client through SearchParamsBridge, which keeps the nav out of the
   * useSearchParams() static-rendering bailout (Step 7a — the page used to
   * pass its own searchParams, which made the ISR route render per request).
   */
  calcMode?: 'cash' | 'trade'
}) {
  const pathname = usePathname() ?? ''
  const [urlCalcMode, setUrlCalcMode] = useState<'cash' | 'trade'>('trade')
  const onParams = useCallback(
    (params: URLSearchParams) => setUrlCalcMode(params.get('tab') === 'cash' ? 'cash' : 'trade'),
    [],
  )
  const calcMode = calcModeOverride ?? urlCalcMode
  const [open, setOpen] = useState(false)
  const router = useRouter()
  // Phones open on the list, not the keyboard (see useCoarsePointer).
  const coarse = useCoarsePointer()
  // A pointer click on a game row navigates through its own <Link> (so
  // middle / cmd-click still open a tab); cmdk's onSelect then only closes.
  // Enter has no click, so onSelect navigates.
  const pointerPick = useRef(false)

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
    // Always solid — no transparent state at the top of the page. Same
    // translucent near-black + blur + hairline as the marketplace navbar.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[rgba(29,30,35,0.86)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl backdrop-saturate-150">
      {calcModeOverride === undefined && <SearchParamsBridge onParams={onParams} />}
      {/* Full-bleed row: no max-width cap, so the brand sits at the true left
          edge of the page and the storefront buttons at the true right edge.
          Only the page gutter insets them. The tab group stays centred on the
          PAGE because the two side groups are each `flex-1` at md+ — equal
          basis means the middle lands dead centre regardless of how wide the
          game name or buttons are. Height is mirrored by HUB_NAV_CLEAR in
          hubNavGeometry.ts; pages clear the fixed bar with it. */}
      <div className="flex h-[56px] w-full items-center gap-2.5 px-4 sm:h-[68px] sm:gap-4 sm:px-6 lg:px-10">
        {/* ── Brand mark + game switcher ──
            shrink-0 below md (the row is already tight on a phone), flex-1 from
            md up so it claims its half and centres the tabs. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3 xl:flex-1">
          <Link
            href="/"
            aria-label="DropMarket home"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Image
              src="/brand/logo-mark-white.avif"
              alt="DropMarket"
              width={34}
              height={34}
              className="h-[28px] w-[28px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] sm:h-[34px] sm:w-[34px]"
              // Already an optimised 2 KB AVIF rendered at ~30px — re-encoding
              // it to WebP bills a transformation and saves nothing.
              unoptimized
            />
          </Link>
          <span aria-hidden className="hidden h-[26px] w-px bg-white/[0.08] sm:block" />

          {/* ── Game switcher ── Radix popover (portalled, collision-aware)
              with a cmdk search list. Non-modal: the page keeps scrolling and
              stays clickable while it is open; outside click / Escape /
              picking a game closes it. -ml-1.5 cancels the trigger's own
              padding so the game icon keeps its alignment with the brand mark. */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              aria-label={`Switch game (current: ${current.name})`}
              className={`-ml-1.5 flex h-10 shrink-0 items-center gap-2.5 rounded-md px-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:h-12 sm:pr-2 ${
                open ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <GameMark name={current.name} imageUrl={current.imageUrl} size="trigger" />
              {/* Game name shows on mobile too — the top/sub split frees the
                  room the single row didn't have. Slightly smaller on phones. */}
              <span className="whitespace-nowrap text-[15px] font-semibold text-text-primary sm:text-[16px]">
                {current.name}
              </span>
              <CaretDownIcon
                size={16}
                weight="bold"
                aria-hidden
                className={`text-text-secondary transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              />
            </PopoverTrigger>

            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={8}
              // Desktop: focus lands in the search box (first focusable).
              // Phones: no auto-focus, so the keyboard doesn't cover the list.
              onOpenAutoFocus={(e) => {
                if (coarse) e.preventDefault()
              }}
              className={`w-[300px] max-w-[calc(100vw-24px)] overflow-hidden p-0 text-[15px] ${VALUE_PANEL}`}
            >
              <Command label="Switch game" filter={filterGames} defaultValue={current.slug} loop>
                <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-3.5">
                  <MagnifyingGlassIcon aria-hidden size={16} weight="bold" className="shrink-0 text-text-tertiary" />
                  <Command.Input
                    placeholder="Search games"
                    className="h-12 min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-tertiary sm:text-sm"
                  />
                </div>
                <Command.List className="max-h-[min(60vh,460px)] overflow-y-auto overscroll-contain p-1.5">
                  <Command.Empty className="px-3 py-6 text-center text-sm text-text-tertiary">No games found</Command.Empty>
                  {games.map((g) => {
                    const active = g.slug === current.slug
                    const href = `/${g.slug}/blog`
                    return (
                      <Command.Item
                        key={g.slug}
                        value={g.slug}
                        keywords={[g.name]}
                        asChild
                        onSelect={() => {
                          setOpen(false)
                          if (pointerPick.current) pointerPick.current = false
                          else router.push(href)
                        }}
                      >
                        <Link
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => {
                            pointerPick.current = true
                          }}
                          className={`flex cursor-pointer select-none items-center gap-3 rounded-md px-2.5 py-2.5 outline-none transition-colors data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-text-primary ${
                            active ? 'bg-white/[0.06] font-semibold text-text-primary' : 'text-text-secondary'
                          }`}
                        >
                          <GameMark name={g.name} imageUrl={g.imageUrl} size="row" />
                          <span className="min-w-0 flex-1 truncate">{g.name}</span>
                          {active && <CheckIcon size={16} weight="bold" aria-hidden className="shrink-0 text-text-primary" />}
                        </Link>
                      </Command.Item>
                    )
                  })}
                </Command.List>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Section tabs — DESKTOP (md+) only ──
            Inline in the single row, centred on the page by the flex-1 side
            groups. On mobile these move to the sub-row below the top row. */}
        <nav className="hidden min-w-0 items-center justify-center gap-9 self-stretch xl:flex xl:flex-none">
          {tabs.map((tab) => {
            const active = isTabActive(tab)
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                // h-full so the active underline sits on the bar's bottom edge
                // rather than hugging the text.
                className={`relative flex h-full shrink-0 items-center whitespace-nowrap text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
                  active ? TAB_ACTIVE : TAB_IDLE
                }`}
              >
                {tab.label}
                {active && (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-text-primary" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Storefront buttons — the primary green Shop + the amber Sell,
            separated by a divider. Data-driven per game. ml-auto pushes the
            pair to the right edge on mobile (where the middle nav is hidden);
            xl:flex-1 takes over the centring role from xl up (below xl a long game name like "Steal a Brainrot" collided with the centred tabs). ── */}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2.5 xl:ml-0 xl:flex-1">
          {(() => {
            // Buy = items board when it exists, else the accounts board.
            const buyHref = itemsHref ?? accountsHref
            if (!buyHref) return null
            return (
              <Link
                href={buyHref}
                className={`group ${VALUE_BTN_PRIMARY} gap-1.5 px-3 sm:h-11 sm:px-4 sm:text-[14px]`}
              >
                {/* Bag icon on phones (matches the Sell button's icon+text);
                    the arrow takes over from sm up and nudges on hover. */}
                <ShoppingBagIcon size={15} weight="bold" aria-hidden className="sm:hidden" />
                <span className="sm:hidden">Shop</span>
                <span className="hidden sm:inline">Shop {current.name}</span>
                <ArrowUpRightIcon
                  size={14}
                  weight="bold"
                  aria-hidden
                  className="hidden transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px motion-reduce:transition-none sm:inline-block"
                />
              </Link>
            )
          })()}
          {/* Sell — solid amber (matches the founding-seller CTA) + a divider
              set it apart from the buy button so it reads as its own action. */}
          {sellHref && (
            <>
              <span aria-hidden className="hidden h-6 w-px bg-white/[0.08] sm:block" />
              <Link
                href={sellHref}
                aria-label={`Sell ${current.name}`}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#F5C451] px-3 text-[13px] font-semibold text-[#141414] transition-[background-color,transform] hover:bg-[#F8D477] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:h-11 sm:px-4 sm:text-[14px]"
              >
                <TagIcon size={15} weight="bold" aria-hidden />
                Sell
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile sub-row: the page tabs (below md only) ──
          The desktop nav above is hidden under xl; these move here so the top
          row stays uncluttered. Left-aligned + horizontally scrollable so a long
          set (Guides · Values · WFL Calculator · Cash Price) never clips the way
          the old single-row bar did. */}
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-white/[0.07] px-4 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = isTabActive(tab)
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex shrink-0 items-center whitespace-nowrap py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
                active ? TAB_ACTIVE : TAB_IDLE
              }`}
            >
              {tab.label}
              {active && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-text-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

/** Game logo (or a 2-3 letter monogram when a game has no art). */
function GameMark({
  name,
  imageUrl,
  size,
}: {
  name: string
  imageUrl: string | null | undefined
  size: 'trigger' | 'row'
}) {
  const box =
    size === 'trigger'
      ? 'h-[28px] w-[28px] sm:h-[34px] sm:w-[34px]'
      : 'h-[26px] w-[26px]'
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote game logo
      <img src={imageUrl} alt="" className={`${box} shrink-0 rounded-md object-cover`} />
    )
  }
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-md bg-bg-overlay text-[10px] font-bold text-text-secondary ${
        size === 'trigger' ? 'sm:text-[11px]' : ''
      }`}
    >
      {name.slice(0, size === 'trigger' ? 3 : 2).toUpperCase()}
    </span>
  )
}
