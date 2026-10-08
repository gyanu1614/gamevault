'use client'

/**
 * HeroSearch — the hero's primary action.
 *
 * Focus opens a panel of games; typing filters it. Each game row links to
 * the game's page and carries its categories as sub-tabs (Currency, Items,
 * Accounts…) that link straight to that section — so "blade" shows Blade
 * Ball with its Currency / Items rows one click away. Matching is on the
 * game name AND the category name, so "robux" finds Roblox ▸ Robux.
 *
 * Data is the navbar's own catalogue query (shared key → one cached fetch).
 * Typing pre-selects the top match; Enter opens that game's Items page (or
 * Currency, or its first section). The form is still a plain GET to
 * /browse?search=…, so Enter with no match (or no JS at all) runs a full
 * marketplace search.
 *
 * The cycling example ("Valorant Accounts", "Robux", …) is an aria-hidden
 * overlay, shown only while the field is empty and unfocused.
 */

import { lockScroll } from '@/lib/scroll-lock'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from '@/components/navigation/AppLink'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import { navCategoriesQuery, type NavCategoryRow } from '@/lib/nav/nav-categories-query'
import { GAME_ICONS } from '../lib/game-icons'

const EXAMPLES = ['Valorant Accounts', 'Robux', 'V-Bucks', 'GTA Accounts', 'CS2 Skins', 'Steal a Brainrot']

/** Goods first, services last — the order shoppers look for them. */
const TYPE_RANK: Record<string, number> = { currency: 0, items: 1, account: 2, top_up: 3, gift_card: 4, service: 5 }
const MAX_TABS = 4
const MAX_ROWS = 6

/**
 * Where Enter lands for a game: its Items page, else Currency, else the
 * first section it has, else the game page. When the match came from a
 * category name ("robux"), `tabs` is already just the matched ones.
 */
const ENTER_PREFERENCE = ['items', 'currency']
function enterHref(g: GameEntry) {
  const byType = (type: string) => g.tabs.find((t) => t.type === type)
  const tab = ENTER_PREFERENCE.map(byType).find(Boolean) ?? g.tabs[0]
  return tab ? `/${g.slug}/${tab.slug}` : `/${g.slug}`
}

interface GameEntry {
  slug: string
  name: string
  icon: string | null
  sortOrder: number
  tabs: { slug: string; label: string; rank: number; type: string }[]
}

/** "VP (Valorant Points)" → "VP", "Buy Accounts" → "Accounts". */
function tabLabel(row: NavCategoryRow) {
  const raw = row.name || row.slug.replace(/^buy-/, '').replace(/[-_]+/g, ' ')
  return raw
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/^buy\s+/i, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function buildIndex(rows: NavCategoryRow[]): GameEntry[] {
  const map = new Map<string, GameEntry>()
  for (const row of rows) {
    const game = row.game
    if (!game?.slug) continue
    const entry =
      map.get(game.slug) ??
      ({
        slug: game.slug,
        name: game.name,
        // No generic fallback image: a game without art gets its initial.
        icon: game.image_url || GAME_ICONS[game.slug] || null,
        sortOrder: game.sort_order ?? 99,
        tabs: [],
      } satisfies GameEntry)
    entry.tabs.push({
      slug: row.slug,
      label: tabLabel(row),
      rank: TYPE_RANK[row.type ?? ''] ?? 9,
      type: row.type ?? '',
    })
    map.set(game.slug, entry)
  }
  for (const entry of map.values()) entry.tabs.sort((a, b) => a.rank - b.rank)
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

function useTypedExample(enabled: boolean) {
  const [text, setText] = useState(EXAMPLES[0])

  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let example = 0
    let chars = EXAMPLES[0].length
    let deleting = true
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const word = EXAMPLES[example]
      chars += deleting ? -1 : 1
      setText(word.slice(0, chars))

      let wait = deleting ? 28 : 55 + Math.random() * 45
      if (!deleting && chars === word.length) {
        deleting = true
        wait = 1800
      } else if (deleting && chars === 0) {
        deleting = false
        example = (example + 1) % EXAMPLES.length
        wait = 320
      }
      timer = setTimeout(tick, wait)
    }

    // Hold the first example fully typed before the cycle starts.
    timer = setTimeout(tick, 2200)
    return () => clearTimeout(timer)
  }, [enabled])

  return text
}

export function HeroSearch() {
  const router = useRouter()
  const rootRef = useRef<HTMLFormElement>(null)
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [active, setActive] = useState(-1)
  const showExample = !focused && value === ''
  const example = useTypedExample(showExample)

  // Phones: the field opens a full-screen search layer pinned to the top of
  // the screen instead of focusing in place (owner, 2026-09-28). Focusing a
  // field inside the sticky hero film made iOS scroll the page to lift it
  // above the keyboard, which carried the film into beat 2 and closed the
  // results. The layer needs no page scroll, and closing it leaves the page
  // exactly where it was.
  const coarse = useCoarsePointer()
  const [takeover, setTakeover] = useState(false)
  useEffect(() => {
    if (!takeover) return
    return lockScroll('html')
  }, [takeover])

  // Only fetched once the panel is wanted; the navbar usually has it cached.
  const { data: rows } = useQuery({ ...navCategoriesQuery, enabled: open || takeover })
  const index = useMemo(() => buildIndex(rows ?? []), [rows])

  const needle = value.trim().toLowerCase()
  const results = useMemo(() => {
    if (!needle) return index.slice(0, MAX_ROWS)
    const out: GameEntry[] = []
    for (const g of index) {
      if (g.name.toLowerCase().includes(needle) || g.slug.includes(needle)) out.push(g)
      else {
        const tabs = g.tabs.filter((t) => t.label.toLowerCase().includes(needle))
        if (tabs.length) out.push({ ...g, tabs })
      }
      if (out.length === MAX_ROWS) break
    }
    return out
  }, [index, needle])

  // Typing pre-selects the top match, so Enter goes straight to it
  // ("valo" + Enter → Valorant). An empty field selects nothing.
  useEffect(() => setActive(needle ? 0 : -1), [needle])

  // The page stays scrollable while the results are open. The panel lives
  // inside the hero copy, which fades (and blurs) with scroll, so the
  // results fade out as you scroll down and come back if you scroll up.
  // Only once you are well past the fade (into the next beat) does the
  // panel actually close. Also closes on an outside press or Escape.
  const [panelMax, setPanelMax] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!open) return
    const startY = window.scrollY
    const fit = () => {
      const bottom = rootRef.current?.getBoundingClientRect().bottom ?? 0
      setPanelMax(Math.max(200, window.innerHeight - bottom - 24))
    }
    fit()

    const onScroll = () => {
      // The hero copy is fully faded by ~20% of a viewport of scroll;
      // 40% is comfortably past it, so the close is never visible.
      if (window.scrollY - startY > window.innerHeight * 0.4) setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      // A selected game wins over the full-text search: open its best
      // section. With no match, Enter falls through to /browse?search=.
      e.preventDefault()
      setOpen(false)
      router.push(enterHref(results[active]))
    }
  }

  // The results list, shared by the inline panel (desktop) and the phone
  // search layer. `onPick` closes whichever is showing.
  const renderResults = (onPick: () => void) => (
    <>
      {!rows ? (
        <p className="px-4 py-5 text-[14px] text-text-tertiary">Loading games…</p>
      ) : results.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-text-tertiary">
          No game matches “{value.trim()}”. Press Search to look through every listing.
        </p>
      ) : (
        <>
          {!needle && <p className="hero-search__heading">Popular</p>}
          <ul>
            {results.map((g, i) => (
              <li
                key={g.slug}
                id={`hero-search-row-${i}`}
                role="option"
                aria-selected={active === i}
                className="hero-search__row"
                data-active={active === i ? '' : undefined}
                onMouseEnter={() => setActive(i)}
              >
                <Link href={`/${g.slug}`} className="flex min-w-0 items-center gap-2.5" onClick={onPick}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-white/[0.06]">
                    {g.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- DB image URLs from several hosts; tiny thumbnails.
                      <img src={g.icon} alt={`${g.name} logo`} aria-hidden className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-[12px] font-semibold text-text-secondary">{g.name.charAt(0)}</span>
                    )}
                  </span>
                  <span className="truncate text-[14px] font-semibold text-text-primary">{g.name}</span>
                </Link>
                <span className="flex flex-wrap gap-1 pl-[38px]">
                  {g.tabs.slice(0, MAX_TABS).map((t) => (
                    <Link
                      key={t.slug}
                      href={`/${g.slug}/${t.slug}`}
                      className="hero-search__tab"
                      onClick={onPick}
                    >
                      {t.label}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )

  const closeTakeover = () => {
    setTakeover(false)
    setFocused(false)
  }

  return (
    <form
      ref={rootRef}
      action="/browse"
      method="get"
      role="search"
      className="relative"
      onSubmit={(e) => {
        setOpen(false)
        // The Search button does what Enter does: a selected game wins.
        if (open && active >= 0 && results[active]) {
          e.preventDefault()
          router.push(enterHref(results[active]))
        }
      }}
    >
      <div className="hero-search">
        <label htmlFor="hero-search" className="sr-only">
          Search games, accounts and items
        </label>
        <Search aria-hidden className="pointer-events-none h-5 w-5 shrink-0 text-text-secondary" strokeWidth={2} />

        <div className="relative min-w-0 flex-1">
          {coarse && (
            // Covers the field on touch screens: opens the search layer
            // without focusing the in-page input (no keyboard scroll).
            <button
              type="button"
              aria-label="Search games, accounts and items"
              onClick={() => setTakeover(true)}
              className="absolute inset-0 z-10 cursor-text"
            />
          )}
          <input
            id="hero-search"
            tabIndex={coarse ? -1 : undefined}
            readOnly={coarse}
            name="search"
            type="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="hero-search-results"
            aria-activedescendant={active >= 0 ? `hero-search-row-${active}` : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setFocused(true)
              setOpen(true)
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            // 16px keeps iOS from zooming the page on focus.
            className="h-12 w-full bg-transparent text-[16px] text-text-primary outline-none placeholder:text-transparent"
            placeholder="Search"
          />
          {showExample && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-nowrap text-[16px] text-text-tertiary"
            >
              Search&nbsp;<span className="text-text-secondary">{example}</span>
              <span className="hero-search__caret" />
            </span>
          )}
        </div>

        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center rounded-md bg-lime px-5 text-[14px] font-semibold text-text-inverse transition-[background-color,transform] duration-fast hover:bg-lime-hover active:scale-[0.98] active:bg-lime-pressed"
        >
          Search
        </button>
      </div>

      {open && (
        <div
          id="hero-search-results"
          role="listbox"
          className="hero-search__panel"
          style={panelMax ? { maxHeight: panelMax } : undefined}
        >
          {renderResults(() => setOpen(false))}
        </div>
      )}
      {takeover &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-[80] flex flex-col bg-[#0b0d11]">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={closeTakeover}
                aria-label="Close Search"
                className="grid h-11 w-10 shrink-0 place-items-center text-white/70 active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="relative flex h-11 flex-1 items-center rounded-md border border-white/[0.12] bg-white/[0.04] focus-within:border-white/[0.24]">
                <Search aria-hidden className="pointer-events-none absolute left-3 h-[17px] w-[17px] text-white/45" />
                <input
                  type="search"
                  // The user tapped search on purpose: the keyboard is wanted.
                  autoFocus
                  enterKeyHint="search"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    closeTakeover()
                    router.push(
                      active >= 0 && results[active]
                        ? enterHref(results[active])
                        : `/browse?search=${encodeURIComponent(value.trim())}`,
                    )
                  }}
                  placeholder="Search games, accounts and items"
                  aria-label="Search games, accounts and items"
                  className="h-full w-full bg-transparent pl-10 pr-3 text-[16px] text-white outline-none placeholder:text-white/45 [&::-webkit-search-cancel-button]:hidden"
                />
              </div>
            </div>
            <div className="hero-search__takeover min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {renderResults(closeTakeover)}
            </div>
          </div>,
          document.body,
        )}
    </form>
  )
}
